package com.moov.pim.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Component
public class AnthropicClient {

    private static final Logger log = LoggerFactory.getLogger(AnthropicClient.class);
    private static final String API_URL = "https://api.anthropic.com/v1/messages";

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${pim.ai.api-key:}")
    private String apiKey;

    @Value("${pim.ai.model:claude-sonnet-4-20250514}")
    private String model;

    @Value("${pim.ai.max-tokens:4096}")
    private int maxTokens;

    public AnthropicClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public Response call(String systemPrompt, String userMessage) {
        if (!isConfigured()) {
            throw new IllegalStateException(
                "Cle API Anthropic non configuree. Definissez ANTHROPIC_API_KEY dans votre .env");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        body.put("temperature", 0.3);

        body.put("system", systemPrompt);

        ArrayNode messages = body.putArray("messages");
        ObjectNode userMsg = messages.addObject();
        userMsg.put("role", "user");
        userMsg.put("content", userMessage);

        HttpEntity<String> request;
        try {
            request = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
        } catch (Exception e) {
            throw new IllegalStateException("Erreur de serialisation de la requete IA", e);
        }

        long start = System.currentTimeMillis();
        try {
            String rawResponse = restTemplate.postForObject(API_URL, request, String.class);
            long latency = System.currentTimeMillis() - start;

            JsonNode json = objectMapper.readTree(rawResponse);

            String text = "";
            JsonNode content = json.get("content");
            if (content != null && content.isArray()) {
                for (JsonNode block : content) {
                    if ("text".equals(block.path("type").asText())) {
                        text = block.path("text").asText();
                        break;
                    }
                }
            }

            JsonNode usage = json.get("usage");
            int inputTokens = usage != null ? usage.path("input_tokens").asInt(0) : 0;
            int outputTokens = usage != null ? usage.path("output_tokens").asInt(0) : 0;

            return new Response(text, inputTokens, outputTokens, latency, true, null);

        } catch (Exception e) {
            long latency = System.currentTimeMillis() - start;
            log.error("Anthropic API call failed: {}", e.getMessage());
            return new Response(null, 0, 0, latency, false, e.getMessage());
        }
    }

    public Response callChat(String systemPrompt, List<Map<String, String>> messages) {
        if (!isConfigured()) {
            throw new IllegalStateException(
                "Cle API Anthropic non configuree. Definissez ANTHROPIC_API_KEY dans votre .env");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        body.put("temperature", 0.7);
        body.put("system", systemPrompt);

        ArrayNode messagesArray = body.putArray("messages");
        for (Map<String, String> msg : messages) {
            ObjectNode msgNode = messagesArray.addObject();
            msgNode.put("role", msg.get("role"));
            msgNode.put("content", msg.get("content"));
        }

        HttpEntity<String> request;
        try {
            request = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
        } catch (Exception e) {
            throw new IllegalStateException("Erreur de serialisation", e);
        }

        long start = System.currentTimeMillis();
        try {
            String rawResponse = restTemplate.postForObject(API_URL, request, String.class);
            long latency = System.currentTimeMillis() - start;
            JsonNode json = objectMapper.readTree(rawResponse);

            String text = "";
            JsonNode content = json.get("content");
            if (content != null && content.isArray()) {
                for (JsonNode block : content) {
                    if ("text".equals(block.path("type").asText())) {
                        text = block.path("text").asText();
                        break;
                    }
                }
            }

            JsonNode usage = json.get("usage");
            int inputTokens = usage != null ? usage.path("input_tokens").asInt(0) : 0;
            int outputTokens = usage != null ? usage.path("output_tokens").asInt(0) : 0;

            return new Response(text, inputTokens, outputTokens, latency, true, null);
        } catch (Exception e) {
            long latency = System.currentTimeMillis() - start;
            log.error("Anthropic API chat call failed: {}", e.getMessage());
            return new Response(null, 0, 0, latency, false, e.getMessage());
        }
    }

    public record Response(
        String text,
        int inputTokens,
        int outputTokens,
        long latencyMs,
        boolean success,
        String error
    ) {}
}
