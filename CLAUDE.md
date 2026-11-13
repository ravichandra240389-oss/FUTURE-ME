# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

"Future Me": a career-roadmap site. A Spring Boot app serves a static single-page
site plus a small JSON API. It shows in-demand career paths for a senior Java
microservices engineer, scored and drawn as railway lines.

## Stack

- **Java 25** (current LTS). Set `<java.version>25</java.version>` in `pom.xml`.
- **Spring Boot** (latest stable) for a REST API, using the Spring Boot parent POM for dependency versions.
- **Maven**, run through the Maven Wrapper (`./mvnw`). Commit the wrapper.

Environment note: the machine currently has OpenJDK 17 installed and no system `mvn`.
Install JDK 25 before building. The Maven Wrapper removes the need for a system Maven.

## Commands

```bash
./mvnw clean verify                    # full build: compile, test, package
./mvnw spring-boot:run                 # run the API locally
./mvnw test                            # run all tests
./mvnw test -Dtest=RoadmapControllerTest                      # run one test class
./mvnw test -Dtest=RoadmapControllerTest#servesCatalog        # run one test method
./mvnw clean package -DskipTests       # build the jar without tests
```

No linter or formatter is configured yet. Add it here once one is chosen.

Until JDK 25 is installed, you can still build on JDK 17 for this run only with
`./mvnw clean verify -Djava.version=17`. Because of that, the code avoids Java 21+ APIs.

## Architecture

- `src/main/resources/data/roadmaps.json`: **all content** (profile, the career lines, their
  scores, pay ranges and stations). To add or edit a path, change this file only.
- `RoadmapService` loads the JSON at startup and validates it: scores must be 1–10, each line
  needs at least 3 stations, and a line must begin at `start` and end at `terminus`.
  Station types are `start`, `station`, `junction` and `terminus`.
- `RoadmapController`: `GET /api/catalog` returns everything; `GET /api/roadmaps/{id}` returns one line.
- `src/main/resources/static/`: `index.html`, `styles.css` and `app.js`, plain JS with no build step.
  `app.js` fetches `/api/catalog` and draws the network map and the railway routes as SVG.
  The railway snakes across rows on desktop and runs as a vertical line under 640px. It also
  re-ranks the lines using the weight sliders. Weights and topic checkboxes are saved in
  `localStorage`.
