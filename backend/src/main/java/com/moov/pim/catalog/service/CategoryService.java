package com.moov.pim.catalog.service;

import com.moov.pim.catalog.api.dto.CategoryRequest;
import com.moov.pim.catalog.api.dto.CategoryResponse;
import com.moov.pim.catalog.domain.Category;
import com.moov.pim.catalog.domain.ItemType;
import com.moov.pim.catalog.repository.CatalogItemRepository;
import com.moov.pim.catalog.repository.CategoryRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Administration de l'arborescence TYPE -> CATEGORIE -> SOUS-CATEGORIE.
 *
 * Trois invariants sont tenus ici, et repris par des contraintes de la base
 * (migration V044) pour qu'une ecriture directe en SQL ne puisse pas les
 * contourner :
 *
 *   1. une categorie appartient a un type et un seul, fixe a la creation ;
 *   2. une sous-categorie herite du type de sa categorie parente ;
 *   3. l'arborescence s'arrete au deuxieme niveau, la ou se rattachent les
 *      elements commerciaux.
 *
 * La mise hors service est logique. Une categorie deja utilisee ne peut pas etre
 * supprimee sans laisser ses elements sans classement : {@link #deactivate} la
 * retire des listes de selection tout en preservant l'existant, et le geste reste
 * reversible par {@link #reactivate}.
 */
@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final CatalogItemRepository catalogItemRepository;

    public CategoryService(CategoryRepository categoryRepository, CatalogItemRepository catalogItemRepository) {
        this.categoryRepository = categoryRepository;
        this.catalogItemRepository = catalogItemRepository;
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        Category parent = null;
        int level = 0;
        ItemType type;

        if (request.parentId() != null) {
            parent = categoryRepository.findById(request.parentId())
                    .orElseThrow(() -> new IllegalArgumentException("Catégorie parente introuvable"));

            if (parent.getLevel() >= 1) {
                throw new IllegalArgumentException(
                        "La classification s'arrête à la sous-catégorie : « " + parent.getName()
                                + " » en est déjà une et ne peut pas en contenir");
            }
            if (!parent.isActive()) {
                throw new IllegalStateException(
                        "La catégorie « " + parent.getName() + " » est désactivée : "
                                + "réactivez-la avant d'y ajouter une sous-catégorie");
            }

            level = parent.getLevel() + 1;

            // Le type ne se choisit pas pour une sous-categorie, il descend du parent.
            // Une valeur contradictoire est refusee plutot qu'ecrasee en silence :
            // c'est exactement la confusion que la classification doit lever.
            type = parent.getType();
            if (request.type() != null && !request.type().isBlank()
                    && ItemType.parse(request.type()) != type) {
                throw new IllegalArgumentException(
                        "Une sous-catégorie hérite du type de sa catégorie parente. « "
                                + parent.getName() + " » est de type " + type.getLabel()
                                + ", le type " + ItemType.parse(request.type()).getLabel()
                                + " ne peut pas lui être associé");
            }
        } else {
            type = ItemType.parse(request.type());
        }

        checkNameAvailable(type, parent, request.name());

        Category category = new Category(request.name(), request.description(), parent, level, type);
        category = categoryRepository.save(category);
        return CategoryResponse.from(category);
    }

    /**
     * Modifie le libelle et la description.
     *
     * Ni le type ni le rattachement ne sont modifiables : les deplacer
     * invaliderait d'un seul geste toutes les sous-categories et tous les elements
     * deja ranges dans la branche. Pour reclasser, on desactive et on recree.
     */
    @Transactional
    public CategoryResponse update(UUID id, CategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable"));

        if (request.type() != null && !request.type().isBlank()
                && ItemType.parse(request.type()) != category.getType()) {
            throw new IllegalArgumentException(
                    "Le type d'une catégorie ne se change pas après création : « " + category.getName()
                            + " » est de type " + category.getType().getLabel()
                            + " et des éléments peuvent déjà s'y rattacher. "
                            + "Désactivez-la et créez la catégorie sous le bon type");
        }

        UUID currentParentId = category.getParent() != null ? category.getParent().getId() : null;
        if (request.parentId() != null && !request.parentId().equals(currentParentId)) {
            throw new IllegalArgumentException(
                    "Le rattachement d'une catégorie ne se change pas après création");
        }

        if (!category.getName().equalsIgnoreCase(request.name())) {
            checkNameAvailable(category.getType(), category.getParent(), request.name());
        }

        category.setName(request.name());
        category.setDescription(request.description());
        category = categoryRepository.save(category);
        return CategoryResponse.from(category);
    }

    /**
     * Retire la categorie des listes de selection, ainsi que ses sous-categories.
     *
     * Laisser une sous-categorie active sous une categorie desactivee produirait
     * un chemin de classement inatteignable : l'interface presente d'abord la
     * categorie, la sous-categorie ne serait jamais proposee.
     */
    @Transactional
    public CategoryResponse deactivate(UUID id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable"));

        category.setActive(false);
        categoryRepository.save(category);

        for (Category child : categoryRepository.findByParentIdOrderByNameAsc(id)) {
            child.setActive(false);
            categoryRepository.save(child);
        }

        return CategoryResponse.from(category);
    }

    /** Remet la categorie en service. Une sous-categorie exige un parent actif. */
    @Transactional
    public CategoryResponse reactivate(UUID id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable"));

        if (category.getParent() != null && !category.getParent().isActive()) {
            throw new IllegalStateException(
                    "Réactivez d'abord la catégorie « " + category.getParent().getName()
                            + " » : une sous-catégorie ne peut pas être proposée seule");
        }

        category.setActive(true);
        categoryRepository.save(category);
        return CategoryResponse.from(category);
    }

    /** Les quatre types de la classification, dans l'ordre de presentation. */
    @Transactional(readOnly = true)
    public List<TypeSummary> listTypes() {
        return java.util.Arrays.stream(ItemType.values())
                .map(type -> new TypeSummary(
                        type.name(),
                        type.getLabel(),
                        categoryRepository.findByTypeOrderByNameAsc(type).size()))
                .toList();
    }

    /** Un type de la classification et le nombre de categories qu'il porte. */
    public record TypeSummary(String code, String label, int categoryCount) {}

    /**
     * Categories racines.
     *
     * @param type       restreint au type demande ; toutes si nul
     * @param activeOnly n'expose que les categories selectionnables. Les
     *                   formulaires de classement passent true, l'ecran
     *                   d'administration false afin de pouvoir reactiver.
     */
    @Transactional(readOnly = true)
    public List<CategoryResponse> listRoots(String type, boolean activeOnly) {
        List<Category> roots;
        if (type == null || type.isBlank()) {
            roots = categoryRepository.findByParentIsNullOrderByNameAsc();
            if (activeOnly) {
                roots = roots.stream().filter(Category::isActive).toList();
            }
        } else {
            ItemType itemType = ItemType.parse(type);
            roots = activeOnly
                    ? categoryRepository.findByTypeAndParentIsNullAndActiveTrueOrderByNameAsc(itemType)
                    : categoryRepository.findByTypeAndParentIsNullOrderByNameAsc(itemType);
        }
        return roots.stream().map(CategoryResponse::from).toList();
    }

    /**
     * Une categorie et son rattachement.
     *
     * Necessaire a l'ouverture d'un formulaire en modification : la fiche ne
     * transporte que l'identifiant du noeud le plus profond, et l'interface doit
     * repositionner les deux listes en cascade — categorie puis sous-categorie —
     * sans avoir a parcourir toute l'arborescence.
     */
    @Transactional(readOnly = true)
    public CategoryResponse getById(UUID id) {
        return CategoryResponse.from(categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable")));
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listChildren(UUID parentId, boolean activeOnly) {
        List<Category> children = activeOnly
                ? categoryRepository.findByParentIdAndActiveTrueOrderByNameAsc(parentId)
                : categoryRepository.findByParentIdOrderByNameAsc(parentId);
        return children.stream().map(CategoryResponse::from).toList();
    }

    /**
     * Suppression physique, reservee aux categories jamais utilisees.
     *
     * Des qu'une categorie a servi, la desactivation est la seule voie : supprimer
     * laisserait des elements sans classement. Le dernier garde-fou est la base
     * elle-meme, qui refuse la suppression d'une categorie encore referencee par
     * une offre.
     */
    @Transactional
    public void delete(UUID id) {
        if (!categoryRepository.findByParentIdOrderByNameAsc(id).isEmpty()) {
            throw new IllegalStateException("Impossible de supprimer : cette catégorie a des sous-catégories");
        }
        if (!catalogItemRepository.findByCategoryId(id).isEmpty()) {
            throw new IllegalStateException("Impossible de supprimer : des éléments sont rattachés à cette catégorie");
        }
        try {
            categoryRepository.deleteById(id);
            categoryRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException(
                    "Impossible de supprimer : des offres sont rattachées à cette catégorie. "
                            + "Désactivez-la plutôt, elle restera lisible sur les fiches existantes");
        }
    }

    private void checkNameAvailable(ItemType type, Category parent, String name) {
        boolean taken = parent == null
                ? categoryRepository.existsByTypeAndParentIsNullAndNameIgnoreCase(type, name)
                : categoryRepository.existsByTypeAndParentIdAndNameIgnoreCase(type, parent.getId(), name);

        if (taken) {
            throw new IllegalArgumentException(parent == null
                    ? "Une catégorie « " + name + " » existe déjà pour le type " + type.getLabel()
                    : "Une sous-catégorie « " + name + " » existe déjà sous « " + parent.getName() + " »");
        }
    }
}
