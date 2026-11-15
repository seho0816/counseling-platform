package com.counseling.backend.counseling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.web.server.ResponseStatusException;

/**
 * Checks, without a database, that the AI connection class and the "not connected" fallback in
 * {@link SummaryGeneratorConfiguration} do not collide: exactly one SummaryGenerator exists, and it is
 * AiServiceSummaryGenerator when that class is present.
 */
class SummaryGeneratorWiringTest {

    @Test
    void usesTheAiServiceGeneratorWhenItIsPresent() {
        try (var context = new AnnotationConfigApplicationContext(
                SummaryGeneratorConfiguration.class, AiServiceSummaryGenerator.class)) {
            assertEquals(1, context.getBeansOfType(SummaryGenerator.class).size());
            assertInstanceOf(AiServiceSummaryGenerator.class, context.getBean(SummaryGenerator.class));
        }
    }

    @Test
    void givesTheSameResultWhenTheClassesAreRegisteredInTheOtherOrder() {
        try (var context = new AnnotationConfigApplicationContext(
                AiServiceSummaryGenerator.class, SummaryGeneratorConfiguration.class)) {
            assertEquals(1, context.getBeansOfType(SummaryGenerator.class).size());
            assertInstanceOf(AiServiceSummaryGenerator.class, context.getBean(SummaryGenerator.class));
        }
    }

    @Test
    void keepsTheNotConnectedFallbackWhenTheAiClassIsAbsent() {
        try (var context = new AnnotationConfigApplicationContext(SummaryGeneratorConfiguration.class)) {
            SummaryGenerator generator = context.getBean(SummaryGenerator.class);
            ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> generator.generate("note"));
            assertEquals(503, e.getStatusCode().value());
        }
    }
}
