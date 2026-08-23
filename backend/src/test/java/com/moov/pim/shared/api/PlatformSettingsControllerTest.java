package com.moov.pim.shared.api;

import com.moov.pim.shared.domain.PlatformSettings;
import com.moov.pim.shared.repository.PlatformSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.lang.reflect.Constructor;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlatformSettingsControllerTest {

    @Mock private PlatformSettingsRepository repository;

    private PlatformSettingsController controller;
    private PlatformSettings settings;

    @BeforeEach
    void setUp() throws Exception {
        controller = new PlatformSettingsController(repository, true);
        Constructor<PlatformSettings> ctor = PlatformSettings.class.getDeclaredConstructor();
        ctor.setAccessible(true);
        settings = ctor.newInstance();
    }

    @Test
    void get_shouldReturnSettingsAndEnforcedPolicy() {
        when(repository.findById(PlatformSettings.SINGLETON_ID)).thenReturn(Optional.of(settings));

        var result = controller.get();

        assertEquals(HttpStatus.OK, result.getStatusCode());
        var body = result.getBody();
        assertEquals("Moov Africa PIM", body.platformName());
        assertEquals("XOF", body.currency());
        assertEquals(12, body.securityPolicy().passwordMinLength());
        assertTrue(body.securityPolicy().mfaMandatoryForAdmins());
    }

    @Test
    void get_shouldReportMfaPolicyDisabled() {
        controller = new PlatformSettingsController(repository, false);
        when(repository.findById(PlatformSettings.SINGLETON_ID)).thenReturn(Optional.of(settings));

        var body = controller.get().getBody();

        assertTrue(!body.securityPolicy().mfaMandatoryForAdmins());
    }

    @Test
    void update_shouldPersistNewValues() {
        when(repository.findById(PlatformSettings.SINGLETON_ID)).thenReturn(Optional.of(settings));
        when(repository.save(any(PlatformSettings.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new PlatformSettingsController.UpdatePlatformSettingsRequest(
                "PIM Moov BF", "en", "EUR", "Europe/Paris");

        var body = controller.update(request, null).getBody();

        assertEquals("PIM Moov BF", body.platformName());
        assertEquals("en", body.defaultLanguage());
        assertEquals("EUR", body.currency());
        assertEquals("Europe/Paris", body.timezone());
    }

    @Test
    void update_shouldRejectUnknownTimezone() {
        var request = new PlatformSettingsController.UpdatePlatformSettingsRequest(
                "PIM", "fr", "XOF", "Mars/Olympus_Mons");

        var ex = assertThrows(IllegalArgumentException.class, () -> controller.update(request, null));
        assertTrue(ex.getMessage().contains("Fuseau horaire inconnu"));
    }

    @Test
    void load_shouldFailExplicitlyIfMigrationMissing() {
        when(repository.findById(PlatformSettings.SINGLETON_ID)).thenReturn(Optional.empty());

        var ex = assertThrows(IllegalStateException.class, () -> controller.get());
        assertTrue(ex.getMessage().contains("V029"));
    }
}
