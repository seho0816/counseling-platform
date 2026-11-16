package com.counseling.backend.counseling;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Replaces the client's name in a counseling note with a placeholder before the note is sent to the
 * AI service. Only the client's own name is known here: other people's names, addresses and similar
 * details in the free text are not found.
 */
final class NameMasker {
    static final String PLACEHOLDER = "[이름]";

    private NameMasker() {
    }

    static String maskClientName(String note, String clientName) {
        if (note == null || clientName == null) {
            return note;
        }
        String name = clientName.strip();
        List<String> terms = new ArrayList<>();
        if (name.length() >= 2) {
            terms.add(name);
        }
        // A three-syllable Korean name is often written without the family name ("하늘 님").
        if (name.length() == 3 && name.chars().allMatch(c -> c >= 0xAC00 && c <= 0xD7A3)) {
            terms.add(name.substring(1));
        }
        terms.sort(Comparator.comparingInt(String::length).reversed());
        String result = note;
        for (String term : terms) {
            result = result.replace(term, PLACEHOLDER);
        }
        return result;
    }
}
