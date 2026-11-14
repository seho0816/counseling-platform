
# 1. Build stage
FROM eclipse-temurin:25-jdk AS build

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install JDK 23 for the project's Gradle toolchain
RUN mkdir -p /opt/jdk23 \
    && curl -fL --retry 3 \
      -o /tmp/jdk23.tar.gz \
      "https://github.com/adoptium/temurin23-binaries/releases/download/jdk-23.0.2%2B7/OpenJDK23U-jdk_x64_linux_hotspot_23.0.2_7.tar.gz" \
    && curl -fL --retry 3 \
      -o /tmp/jdk23.sha256 \
      "https://github.com/adoptium/temurin23-binaries/releases/download/jdk-23.0.2%2B7/OpenJDK23U-jdk_x64_linux_hotspot_23.0.2_7.tar.gz.sha256.txt" \
    && echo "$(awk '{print $1}' /tmp/jdk23.sha256)  /tmp/jdk23.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/jdk23.tar.gz -C /opt/jdk23 --strip-components=1 \
    && rm /tmp/jdk23.tar.gz /tmp/jdk23.sha256

ENV JAVA_HOME=/opt/jdk23
ENV PATH="/opt/jdk23/bin:${PATH}"

COPY . .

RUN chmod +x gradlew \
    && ./gradlew --no-daemon bootJar -x test

RUN JAR=$(find build/libs -maxdepth 1 -type f \
    -name '*.jar' ! -name '*-plain.jar' -print -quit) \
    && test -n "$JAR" \
    && cp "$JAR" /app/application.jar

# 2. Runtime stage
FROM eclipse-temurin:25-jre

WORKDIR /app

COPY --from=build /app/application.jar application.jar

ENV SERVER_PORT=10000
EXPOSE 10000

ENTRYPOINT ["java", "-jar", "application.jar"]
