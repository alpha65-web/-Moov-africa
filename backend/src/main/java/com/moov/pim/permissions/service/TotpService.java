package com.moov.pim.permissions.service;

import org.apache.commons.codec.binary.Base32;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;

@Service
public class TotpService {

    private static final int TIME_STEP_SECONDS = 30;
    private static final int CODE_DIGITS = 6;
    private static final int WINDOW_SIZE = 1;
    private static final Base32 BASE32 = new Base32();

    public String generateSecret() {
        byte[] bytes = new byte[20];
        new SecureRandom().nextBytes(bytes);
        return BASE32.encodeToString(bytes).replace("=", "");
    }

    public String buildOtpAuthUri(String secret, String email) {
        return String.format(
                "otpauth://totp/MoovAfrica:%s?secret=%s&issuer=MoovAfrica&algorithm=SHA1&digits=%d&period=%d",
                email, secret, CODE_DIGITS, TIME_STEP_SECONDS);
    }

    public boolean verifyCode(String base32Secret, String code) {
        if (code == null || code.length() != CODE_DIGITS) return false;
        long currentStep = System.currentTimeMillis() / 1000 / TIME_STEP_SECONDS;
        for (int i = -WINDOW_SIZE; i <= WINDOW_SIZE; i++) {
            if (generateCode(base32Secret, currentStep + i).equals(code)) {
                return true;
            }
        }
        return false;
    }

    private String generateCode(String base32Secret, long timeStep) {
        try {
            byte[] key = BASE32.decode(base32Secret);
            byte[] data = ByteBuffer.allocate(8).putLong(timeStep).array();
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] hash = mac.doFinal(data);
            int offset = hash[hash.length - 1] & 0x0F;
            int binary = ((hash[offset] & 0x7F) << 24)
                    | ((hash[offset + 1] & 0xFF) << 16)
                    | ((hash[offset + 2] & 0xFF) << 8)
                    | (hash[offset + 3] & 0xFF);
            int otp = binary % (int) Math.pow(10, CODE_DIGITS);
            return String.format("%0" + CODE_DIGITS + "d", otp);
        } catch (Exception e) {
            throw new IllegalStateException("TOTP generation failed", e);
        }
    }
}
