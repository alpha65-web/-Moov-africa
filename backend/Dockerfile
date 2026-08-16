FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN apk add --no-cache maven \
    && mvn package -DskipTests -q \
    && mv target/*.jar app.jar

FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache wget \
    && addgroup -S pim && adduser -S -G pim -s /sbin/nologin pim \
    && rm -rf /var/cache/apk/* /tmp/*
WORKDIR /app
COPY --from=build --chown=pim:pim /app/app.jar app.jar
USER pim
EXPOSE 8092
ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom -Dfile.encoding=UTF-8"
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:8092/api/v1/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
