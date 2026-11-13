# Future Me

A career-roadmap site for a senior Java microservices engineer. It lists in-demand
career paths, scores them, and draws each one as a railway line with stations
from where you are now (`start`) to the target role (`terminus`).

## Career lines

- AI Platform Engineer (JVM)
- Principal Distributed Systems Architect
- Platform Engineering Lead
- Real-Time Data & Streaming Engineer
- Legacy Modernization Architect
- Application Security & DevSecOps Architect
- JVM Performance & Reliability Engineer
- Engineering Manager → Director

Each line has scores, pay ranges, reasons it matters now, skill gaps, target roles
and a sequence of stations. On the site, weight sliders re-rank the lines to match
your priorities.

## Stack

- Java 25
- Spring Boot 4 (Web MVC), serving a JSON API and a static front end
- Plain HTML, CSS and JavaScript with SVG drawing and no build step
- Maven, run through the Maven Wrapper (`./mvnw`)

## Getting started

Prerequisite: JDK 25. You don't need a system Maven, because the wrapper downloads it.

```bash
./mvnw spring-boot:run
```

Then open <http://localhost:8080>.

Other commands:

```bash
./mvnw clean verify               # compile, test and package
./mvnw test                       # run the tests
./mvnw clean package -DskipTests  # build the jar only
```

## API

| Method | Path                  | Returns                                  |
|--------|-----------------------|------------------------------------------|
| GET    | `/api/catalog`        | Profile, disclaimer and all career lines |
| GET    | `/api/roadmaps/{id}`  | One career line, e.g. `ai-platform`      |

## Project layout

```
src/main/java/com/futureme/roadmap/    Spring Boot app, controller, service
src/main/resources/data/roadmaps.json  All content: profile, lines, scores, stations
src/main/resources/static/             index.html, styles.css, app.js
src/test/java/...                      Controller tests
```

## Editing content

All content is in `src/main/resources/data/roadmaps.json`. To add or change a path,
edit that file only. When the app starts it checks that:

- scores are between 1 and 10
- each line has at least 3 stations
- each line starts with a `start` station and ends with a `terminus`

Station types are `start`, `station`, `junction` and `terminus`.
