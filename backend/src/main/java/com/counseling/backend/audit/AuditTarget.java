package com.counseling.backend.audit;

/** A deliberately small allowlist of sensitive endpoints to audit. */
record AuditTarget(String resourceType, Long resourceId, String action) {
    static AuditTarget from(String method, String path) {
        if (method == null || path == null) return null;
        try {
            if ("GET".equals(method) && "/api/cases".equals(path))
                return new AuditTarget("CASE", null, "READ_LIST");
            if ("GET".equals(method) && "/api/admin/intakes".equals(path))
                return new AuditTarget("INTAKE", null, "READ_LIST");
            if ("GET".equals(method) && "/api/admin/counselors".equals(path))
                return new AuditTarget("COUNSELOR", null, "READ_LIST");
            if ("POST".equals(method) && "/api/admin/counselors".equals(path))
                return new AuditTarget("COUNSELOR", null, "CREATE");
            if ("POST".equals(method) && "/api/admin/clients".equals(path))
                return new AuditTarget("CLIENT", null, "CREATE");
            if ("POST".equals(method) && "/api/admin/cases".equals(path))
                return new AuditTarget("CASE", null, "CREATE");
            if ("POST".equals(method) && "/api/intakes".equals(path))
                return new AuditTarget("INTAKE", null, "SUBMIT");

            String[] parts = path.split("/");
            // /api/cases/{caseId}[/status|/sessions[/{sessionId}]]
            if (parts.length >= 4 && "api".equals(parts[1]) && "cases".equals(parts[2])
                    && isId(parts[3])) {
                long caseId = Long.parseLong(parts[3]);
                if (parts.length == 4 && "GET".equals(method))
                    return new AuditTarget("CASE", caseId, "READ");
                if (parts.length == 5 && "status".equals(parts[4]) && "PATCH".equals(method))
                    return new AuditTarget("CASE", caseId, "UPDATE_STATUS");
                if (parts.length == 5 && "sessions".equals(parts[4])) {
                    if ("GET".equals(method)) return new AuditTarget("SESSION", caseId, "READ_LIST");
                    if ("POST".equals(method)) return new AuditTarget("SESSION", caseId, "CREATE");
                }
                if (parts.length == 6 && "sessions".equals(parts[4]) && isId(parts[5])) {
                    long sessionId = Long.parseLong(parts[5]);
                    if ("GET".equals(method)) return new AuditTarget("SESSION", sessionId, "READ");
                    if ("PATCH".equals(method)) return new AuditTarget("SESSION", sessionId, "UPDATE");
                }
            }

            // /api/sessions/{sessionId}/summary[/generate|/confirm]
            if (parts.length >= 5 && "api".equals(parts[1]) && "sessions".equals(parts[2])
                    && isId(parts[3]) && "summary".equals(parts[4])) {
                long sessionId = Long.parseLong(parts[3]);
                if (parts.length == 5 && "GET".equals(method))
                    return new AuditTarget("SUMMARY", sessionId, "READ");
                if (parts.length == 6 && "generate".equals(parts[5]) && "POST".equals(method))
                    return new AuditTarget("SUMMARY", sessionId, "GENERATE");
                if (parts.length == 6 && "confirm".equals(parts[5]) && "PUT".equals(method))
                    return new AuditTarget("SUMMARY", sessionId, "CONFIRM");
            }

            // /api/admin/intakes/{intakeId}[/convert]
            if (parts.length >= 5 && "api".equals(parts[1]) && "admin".equals(parts[2])
                    && "intakes".equals(parts[3]) && isId(parts[4])) {
                long intakeId = Long.parseLong(parts[4]);
                if (parts.length == 5 && "GET".equals(method))
                    return new AuditTarget("INTAKE", intakeId, "READ");
                if (parts.length == 6 && "convert".equals(parts[5]) && "POST".equals(method))
                    return new AuditTarget("INTAKE", intakeId, "CONVERT");
            }
            // /api/admin/cases/{caseId}/assignment
            if (parts.length == 6 && "api".equals(parts[1]) && "admin".equals(parts[2])
                    && "cases".equals(parts[3]) && isId(parts[4])
                    && "assignment".equals(parts[5]) && "PATCH".equals(method))
                return new AuditTarget("CASE", Long.parseLong(parts[4]), "ASSIGN");
        } catch (NumberFormatException ignored) {
            // Very large path numbers must not break normal HTTP handling.
        }
        return null;
    }

    private static boolean isId(String value) {
        return value.matches("[1-9][0-9]*");
    }
}
