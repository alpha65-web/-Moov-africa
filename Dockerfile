FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
COPY mvnw .
COPY .mvn .mvn
RUN chmod +x mvnw 2>/dev/null; \
    if [ -f mvnw ]; then ./mvnw package -DskipTests -q; \
    else apt-get update && apt-get install -y --no-install-recommends maven && mvn package -DskipTests -q; fi

FROM eclipse-temurin:21-jre
RUN groupadd -r pim && useradd -r -g pim -s /bin/false pim
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
RUN chown -R pim:pim /app
USER pim
EXPOSE 8092
ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
