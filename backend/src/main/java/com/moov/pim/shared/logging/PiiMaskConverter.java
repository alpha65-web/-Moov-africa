package com.moov.pim.shared.logging;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.pattern.CompositeConverter;

import java.util.regex.Pattern;

public class PiiMaskConverter extends CompositeConverter<ILoggingEvent> {

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})");

    private static final Pattern PHONE_PATTERN =
            Pattern.compile("\\b(\\+?\\d{1,3}[\\s-]?)?(\\d[\\s-]?){7,14}\\b");

    private static final Pattern IP_PATTERN =
            Pattern.compile("\\b(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\b");

    private static final Pattern NAME_FIELDS =
            Pattern.compile("(?i)(firstName|lastName|first_name|last_name|nom|prenom)\"?\\s*[:=]\\s*\"?([^\"\\s,}]+)");

    private static final Pattern JWT_PATTERN =
            Pattern.compile("eyJ[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}");

    private static final Pattern PASSWORD_PATTERN =
            Pattern.compile("(?i)(password|passwd|pwd|secret|token)\"?\\s*[:=]\\s*\"?([^\"\\s,}]+)");

    @Override
    protected String transform(ILoggingEvent event, String msg) {
        if (msg == null) return null;

        msg = EMAIL_PATTERN.matcher(msg).replaceAll(m -> {
            String local = m.group(1);
            String masked = local.length() > 2
                    ? local.substring(0, 2) + "***"
                    : "***";
            return masked + "@" + m.group(2);
        });

        msg = IP_PATTERN.matcher(msg).replaceAll("$1.$2.***. ***");

        msg = JWT_PATTERN.matcher(msg).replaceAll("[JWT-REDACTED]");

        msg = PASSWORD_PATTERN.matcher(msg).replaceAll("$1: [REDACTED]");

        msg = NAME_FIELDS.matcher(msg).replaceAll("$1: [REDACTED]");

        return msg;
    }
}
