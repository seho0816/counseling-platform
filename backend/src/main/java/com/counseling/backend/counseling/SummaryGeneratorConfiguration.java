package com.counseling.backend.counseling;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Makes the lack of an AI integration explicit rather than silently fabricating a draft. */
@Configuration(proxyBeanMethods = false)
public class SummaryGeneratorConfiguration {
    @Bean
    @ConditionalOnMissingBean(SummaryGenerator.class)
    SummaryGenerator unconfiguredSummaryGenerator() {
        return note -> {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE, "AI summary generator is not connected yet");
        };
    }
}
