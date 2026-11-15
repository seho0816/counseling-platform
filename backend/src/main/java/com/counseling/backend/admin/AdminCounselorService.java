package com.counseling.backend.admin;

import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

@Service
public class AdminCounselorService {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final ActiveActorService activeActors;

    public AdminCounselorService(UserRepository users, PasswordEncoder passwordEncoder,
                                 ActiveActorService activeActors) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.activeActors = activeActors;
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CounselorResponse create(CreateCounselorRequest request, Authentication authentication) {
        activeActors.require(authentication, UserRole.ADMIN);
        if (request == null || request.email() == null || request.name() == null || request.password() == null) {
            throw badRequest("email, name and password are required");
        }
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String name = request.name().trim();
        String password = request.password();
        if (email.length() > 255 || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw badRequest("Invalid email");
        }
        if (name.isBlank() || name.length() > 100) {
            throw badRequest("name must be 1..100 characters");
        }
        // BCrypt uses only the first 72 bytes; reject longer passwords instead of silently truncating.
        int bytes = password.getBytes(StandardCharsets.UTF_8).length;
        if (password.length() < 12 || bytes > 72) {
            throw badRequest("Password must be at least 12 characters and at most 72 UTF-8 bytes");
        }
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }
        User newCounselor = new User(email, passwordEncoder.encode(password), name, UserRole.COUNSELOR);
        return CounselorResponse.from(users.saveAndFlush(newCounselor));
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public List<CounselorResponse> list(Authentication authentication) {
        activeActors.require(authentication, UserRole.ADMIN);
        return users.findAll().stream()
            .filter(u -> u.getRole() == UserRole.COUNSELOR)
            .map(CounselorResponse::from).toList();
    }



@Transactional
@PreAuthorize("hasRole('ADMIN')")
public CounselorResponse updateStatus(
        Long counselorId,
        UpdateCounselorStatusRequest request,
        Authentication authentication) {

    // 관리자 권한 및 활성 계정 확인
    activeActors.require(authentication, UserRole.ADMIN);

    // 입력값 검증
    if (counselorId == null || counselorId < 1) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Invalid counselor id");
    }

    if (request == null || request.isActive() == null) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "isActive is required");
    }

    // 상담사 계정 조회
    User counselor = users.findById(counselorId)
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.NOT_FOUND, "Counselor not found"));

    // 관리자 계정 등의 변경 방지
    if (counselor.getRole() != UserRole.COUNSELOR) {
        throw new ResponseStatusException(
            HttpStatus.NOT_FOUND, "Counselor not found");
    }

    // 활성 상태 변경
    counselor.setActive(request.isActive());

    // DB 저장 후 변경 결과 반환
    return CounselorResponse.from(
        users.saveAndFlush(counselor)
    );
}


    private static ResponseStatusException badRequest(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
