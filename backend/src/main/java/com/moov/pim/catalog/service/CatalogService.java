package com.moov.pim.catalog.service;

import com.moov.pim.catalog.api.dto.CatalogItemResponse;
import com.moov.pim.catalog.api.dto.PackRequest;
import com.moov.pim.catalog.api.dto.ProductRequest;
import com.moov.pim.catalog.api.dto.ServiceRequest;
import com.moov.pim.catalog.domain.CatalogItem;
import com.moov.pim.catalog.domain.CatalogItemStatus;
import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.domain.ItemType;
import com.moov.pim.catalog.domain.Pack;
import com.moov.pim.catalog.domain.PackItem;
import com.moov.pim.catalog.domain.Product;
import com.moov.pim.catalog.domain.Service;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.CategoryRepository;
import com.moov.pim.catalog.repository.PackRepository;
import com.moov.pim.catalog.repository.ProductRepository;
import com.moov.pim.catalog.repository.ServiceRepository;
import com.moov.pim.catalog.api.dto.DuplicateFlagResponse;
import com.moov.pim.catalog.domain.DuplicateFlag;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.shared.event.CatalogItemCreatedEvent;
import com.moov.pim.shared.event.CatalogItemArchivedEvent;
import jakarta.persistence.criteria.Predicate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.List;
import java.util.UUID;

@org.springframework.stereotype.Service
public class CatalogService {

    private final CatalogItemRepository catalogItemRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final ServiceRepository serviceRepository;
    private final PackRepository packRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final UserRepository userRepository;
    private final DuplicateDetectionService duplicateDetectionService;

    public CatalogService(CatalogItemRepository catalogItemRepository,
                          CategoryRepository categoryRepository,
                          ProductRepository productRepository,
                          ServiceRepository serviceRepository,
                          PackRepository packRepository,
                          ApplicationEventPublisher eventPublisher,
                          UserRepository userRepository,
                          DuplicateDetectionService duplicateDetectionService) {
        this.duplicateDetectionService = duplicateDetectionService;
        this.catalogItemRepository = catalogItemRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.serviceRepository = serviceRepository;
        this.packRepository = packRepository;
        this.eventPublisher = eventPublisher;
        this.userRepository = userRepository;
    }

    /**
     * Le demandeur a-t-il a connaitre l'auteur des briques qu'il consulte ?
     *
     * Meme regle que sur les offres : le chef de service « voit qui a cree quelle
     * offre/produit » (cahier des charges l. 114), tandis que « les chefs de
     * produit entre eux ne voient jamais qui a cree quel produit » (l. 115). Le
     * chef de produit est donc exclu — il ne voit de toute facon que ses propres
     * briques — et le community manager n'a pas acces a cet ecran.
     */
    private boolean maySeeAuthors() {
        return hasTransversalScope();
    }

    /** Resout en une seule requete les identites citees par un lot de briques. */
    private Map<UUID, String> resolveAuthorNames(Collection<CatalogItem> items) {
        if (!maySeeAuthors()) return Map.of();

        Set<UUID> ids = items.stream()
                .map(CatalogItem::getCreatedById)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        if (ids.isEmpty()) return Map.of();

        Map<UUID, String> names = new HashMap<>();
        for (User user : userRepository.findAllById(ids)) {
            names.put(user.getId(), (user.getFirstName() + " " + user.getLastName()).trim());
        }
        return names;
    }

    /** Resout les identites d'une page en une requete, puis projette. */
    private Page<CatalogItemResponse> withAuthors(Page<CatalogItem> page) {
        Map<UUID, String> names = resolveAuthorNames(page.getContent());
        Map<UUID, String> paths = resolveCategoryPaths(page.getContent());
        return page.map(item -> CatalogItemResponse.from(item, names, paths));
    }

    /** Meme chose pour une liste non paginee. */
    private List<CatalogItemResponse> withAuthors(List<CatalogItem> items) {
        Map<UUID, String> names = resolveAuthorNames(items);
        Map<UUID, String> paths = resolveCategoryPaths(items);
        return items.stream().map(item -> CatalogItemResponse.from(item, names, paths)).toList();
    }

    /**
     * Verifie que la categorie visee correspond au type de l'element cree.
     *
     * C'est la garde qui rend le contournement de l'interface sans effet : une
     * requete envoyee directement a l'API avec type = PRODUIT et categorie =
     * « Forfaits Data » est refusee ici, avant meme que la cle etrangere composite
     * de la base n'ait a intervenir. Le message nomme les deux types en presence,
     * faute de quoi l'appelant ne saurait pas ce qu'on lui reproche.
     *
     * @return la categorie resolue, pour en tirer le chemin de classement
     */
    private Category checkCategory(UUID categoryId, ItemType expected) {
        if (categoryId == null) {
            throw new IllegalArgumentException(
                    "La catégorie est obligatoire : un élément non classé est introuvable "
                            + "dans le catalogue et inexploitable par les canaux de diffusion");
        }

        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable"));

        if (category.getType() != expected) {
            throw new IllegalArgumentException(
                    "La catégorie « " + categoryPath(category) + " » est de type "
                            + category.getType().getLabel() + " : elle ne peut pas classer un élément de type "
                            + expected.getLabel());
        }
        if (!category.isActive()) {
            throw new IllegalStateException(
                    "La catégorie « " + categoryPath(category) + " » est désactivée "
                            + "et ne peut plus recevoir de nouvel élément");
        }
        return category;
    }

    /** Chemin de classement lisible : « Équipements / Routeurs ». */
    private static String categoryPath(Category category) {
        if (category == null) return null;
        Category parent = category.getParent();
        return parent != null ? parent.getName() + " / " + category.getName() : category.getName();
    }

    /** Chemins de classement d'un lot de briques, resolus en une seule requete. */
    private Map<UUID, String> resolveCategoryPaths(Collection<CatalogItem> items) {
        Set<UUID> ids = items.stream()
                .map(CatalogItem::getCategoryId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        if (ids.isEmpty()) return Map.of();

        Map<UUID, String> paths = new HashMap<>();
        for (Category category : categoryRepository.findAllById(ids)) {
            paths.put(category.getId(), categoryPath(category));
        }
        return paths;
    }

    @Transactional
    public CatalogItemResponse createProduct(ProductRequest request) {
        Category category = checkCategory(request.categoryId(), ItemType.PRODUCT);

        Product product = new Product();
        product.setName(request.name());
        product.setDescription(request.description());
        product.setBasePrice(request.basePrice());
        product.setCategoryId(request.categoryId());
        product.setCharacteristics(request.characteristics());
        product.setPackOnly(request.packOnly());
        product.setCreatedById(currentUserId());
        product = productRepository.save(product);

        // Rapprochement de doublons (cahier des charges 7.2). Volontairement non
        // bloquant : deux produits peuvent legitimement porter des noms voisins —
        // deux capacites d'un meme modele, par exemple. C'est au chef de produit de
        // trancher, la suspicion est seulement consignee et signalee.
        duplicateDetectionService.flagPotentialDuplicates(product);

        eventPublisher.publishEvent(new CatalogItemCreatedEvent(product.getId(), product.getName(), "Product", currentUserId()));
        return CatalogItemResponse.from(product, Map.of(),
                Map.of(category.getId(), categoryPath(category)));
    }

    /**
     * Rapprochements de doublons en attente d'arbitrage, libelles resolus.
     *
     * La table etait prevue depuis l'origine mais rien ne l'alimentait ni ne la
     * lisait. Sans cette lecture, la detection retomberait dans le defaut qu'elle
     * corrige : une donnee ecrite que personne ne voit.
     */
    @Transactional(readOnly = true)
    public List<DuplicateFlagResponse> pendingDuplicates() {
        List<DuplicateFlag> flags = duplicateDetectionService.unresolved();
        if (flags.isEmpty()) return List.of();

        Set<UUID> productIds = new java.util.LinkedHashSet<>();
        flags.forEach(flag -> {
            productIds.add(flag.getSourceProductId());
            productIds.add(flag.getDuplicateProductId());
        });

        Map<UUID, String> names = new HashMap<>();
        catalogItemRepository.findAllById(productIds)
                .forEach(item -> names.put(item.getId(), item.getName()));

        return flags.stream().map(flag -> DuplicateFlagResponse.from(flag, names)).toList();
    }

    /** Ecarte un rapprochement : les deux produits sont bien distincts. */
    @Transactional
    public void resolveDuplicate(UUID flagId) {
        duplicateDetectionService.resolve(flagId, currentUserId());
    }

    @Transactional
    public CatalogItemResponse createService(ServiceRequest request) {
        Category category = checkCategory(request.categoryId(), ItemType.SERVICE);

        Service service = new Service();
        service.setName(request.name());
        service.setDescription(request.description());
        service.setBasePrice(request.basePrice());
        service.setCategoryId(request.categoryId());
        service.setServiceType(request.serviceType());
        service.setBillingCycle(request.billingCycle());
        service.setCharacteristics(request.characteristics());
        service.setPackOnly(request.packOnly());
        service.setCreatedById(currentUserId());
        service = serviceRepository.save(service);
        eventPublisher.publishEvent(new CatalogItemCreatedEvent(service.getId(), service.getName(), "Service", currentUserId()));
        return CatalogItemResponse.from(service, Map.of(),
                Map.of(category.getId(), categoryPath(category)));
    }

    @Transactional
    public CatalogItemResponse createPack(PackRequest request) {
        Category category = checkCategory(request.categoryId(), ItemType.PACK);

        Pack pack = new Pack();
        pack.setName(request.name());
        pack.setDescription(request.description());
        pack.setBasePrice(request.basePrice());
        pack.setCategoryId(request.categoryId());
        pack.setBundlePrice(request.bundlePrice());
        pack.setBundleDiscount(request.bundleDiscount());
        pack.setCreatedById(currentUserId());

        for (PackRequest.PackItemRequest itemReq : request.items()) {
            if (!catalogItemRepository.existsById(itemReq.catalogItemId())) {
                throw new IllegalArgumentException("Élément du catalogue introuvable : " + itemReq.catalogItemId());
            }
            pack.addItem(new PackItem(itemReq.catalogItemId(), itemReq.quantity()));
        }

        pack = packRepository.save(pack);
        eventPublisher.publishEvent(new CatalogItemCreatedEvent(pack.getId(), pack.getName(), "Pack", currentUserId()));
        return CatalogItemResponse.from(pack, Map.of(),
                Map.of(category.getId(), categoryPath(category)));
    }

    @Transactional
    public CatalogItemResponse updateProduct(UUID id, ProductRequest request) {
        Category category = checkCategory(request.categoryId(), ItemType.PRODUCT);

        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));
        checkOwnership(product);
        product.setName(request.name());
        product.setDescription(request.description());
        product.setBasePrice(request.basePrice());
        product.setCategoryId(request.categoryId());
        product.setCharacteristics(request.characteristics());
        product.setPackOnly(request.packOnly());
        product = productRepository.save(product);
        return CatalogItemResponse.from(product, Map.of(),
                Map.of(category.getId(), categoryPath(category)));
    }

    @Transactional
    public CatalogItemResponse updateService(UUID id, ServiceRequest request) {
        Category category = checkCategory(request.categoryId(), ItemType.SERVICE);

        Service service = serviceRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Service introuvable"));
        checkOwnership(service);
        service.setName(request.name());
        service.setDescription(request.description());
        service.setBasePrice(request.basePrice());
        service.setCategoryId(request.categoryId());
        service.setServiceType(request.serviceType());
        service.setBillingCycle(request.billingCycle());
        service.setCharacteristics(request.characteristics());
        service.setPackOnly(request.packOnly());
        service = serviceRepository.save(service);
        return CatalogItemResponse.from(service, Map.of(),
                Map.of(category.getId(), categoryPath(category)));
    }

    @Transactional
    public CatalogItemResponse updatePack(UUID id, PackRequest request) {
        Category category = checkCategory(request.categoryId(), ItemType.PACK);

        Pack pack = packRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pack introuvable"));
        checkOwnership(pack);
        pack.setName(request.name());
        pack.setDescription(request.description());
        pack.setBasePrice(request.basePrice());
        pack.setCategoryId(request.categoryId());
        pack.setBundlePrice(request.bundlePrice());
        pack.setBundleDiscount(request.bundleDiscount());

        pack.getItems().clear();
        for (PackRequest.PackItemRequest itemReq : request.items()) {
            if (!catalogItemRepository.existsById(itemReq.catalogItemId())) {
                throw new IllegalArgumentException("Élément du catalogue introuvable : " + itemReq.catalogItemId());
            }
            pack.addItem(new PackItem(itemReq.catalogItemId(), itemReq.quantity()));
        }

        pack = packRepository.save(pack);
        return CatalogItemResponse.from(pack, Map.of(),
                Map.of(category.getId(), categoryPath(category)));
    }

    @Transactional(readOnly = true)
    public Page<CatalogItemResponse> search(String search, UUID categoryId, String type, Pageable pageable) {
        Specification<CatalogItem> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("status"), CatalogItemStatus.ACTIVE));

            if (!hasTransversalScope()) {
                predicates.add(cb.equal(root.get("createdById"), currentUserId()));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(root.get("description")), pattern)
                ));
            }
            if (categoryId != null) {
                predicates.add(cb.equal(root.get("categoryId"), categoryId));
            }
            if (type != null) {
                Class<? extends CatalogItem> typeClass = resolveType(type);
                if (typeClass != null) {
                    predicates.add(cb.equal(root.type(), typeClass));
                }
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return withAuthors(catalogItemRepository.findAll(spec, pageable));
    }

    @Transactional(readOnly = true)
    public List<CatalogItemResponse> listAll() {
        if (hasTransversalScope()) {
            return withAuthors(catalogItemRepository.findByStatus(CatalogItemStatus.ACTIVE));
        }
        return withAuthors(
                catalogItemRepository.findByStatusAndCreatedById(CatalogItemStatus.ACTIVE, currentUserId()));
    }

    @Transactional(readOnly = true)
    public CatalogItemResponse getById(UUID id) {
        CatalogItem item = catalogItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Élément du catalogue introuvable"));
        checkOwnership(item);
        return CatalogItemResponse.from(item, resolveAuthorNames(List.of(item)),
                resolveCategoryPaths(List.of(item)));
    }

    @Transactional
    public void archive(UUID id) {
        CatalogItem item = catalogItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Élément du catalogue introuvable"));
        checkOwnership(item);
        item.setStatus(CatalogItemStatus.ARCHIVED);
        catalogItemRepository.save(item);
        eventPublisher.publishEvent(new CatalogItemArchivedEvent(item.getId(), currentUserId()));
    }

    private Class<? extends CatalogItem> resolveType(String type) {
        if (type == null) return null;
        return switch (type.toUpperCase()) {
            case "PRODUCT" -> Product.class;
            case "SERVICE" -> Service.class;
            case "PACK" -> Pack.class;
            default -> null;
        };
    }

    private void checkOwnership(CatalogItem item) {
        if (!hasTransversalScope() && !item.getCreatedById().equals(currentUserId())) {
            throw new AccessDeniedException("Accès interdit : cet élément ne vous appartient pas");
        }
    }

    /**
     * Perimetre de visibilite et d'intervention sur une fiche.
     *
     * Le cahier des charges (regles/PROMPT_MAITRE..., regles de visibilite) impose
     * deux regimes distincts :
     *   « un chef de produit ne voit que les offres qu'il a lui-meme creees,
     *     jamais celles des autres chefs de produit »
     *   « le chef de service a une vue transversale sur plusieurs chefs de produit
     *     et voit qui a cree quelle offre/produit »
     *
     * Le code ne connaissait que le couple administrateur / proprietaire : tout role
     * non administrateur etait ramene a ses propres fiches. Le chef de service ne
     * pouvait donc voir aucune offre a valider, l'analyste marketing aucune offre a
     * enrichir et le chef de departement aucune offre a publier, alors qu'ils
     * detiennent OFFER_VALIDATE, OFFER_ENRICH et OFFER_PUBLISH. Le circuit de
     * validation etait inapplicable des que l'auteur n'etait pas l'acteur suivant.
     *
     * Les permissions restent verifiees en amont par les annotations @PreAuthorize
     * des controleurs : ce perimetre ne fait que decider si l'acteur est limite a ses
     * propres fiches, il n'accorde aucune capacite supplementaire.
     */
    private boolean hasTransversalScope() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUser().getRole().getName().hasTransversalScope();
    }

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
