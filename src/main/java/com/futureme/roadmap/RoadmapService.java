package com.futureme.roadmap;

import com.futureme.roadmap.RoadmapCatalog.Roadmap;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

/** Loads the roadmap catalog once at startup and checks it is well formed. */
@Service
public class RoadmapService {

    static final String CATALOG_PATH = "data/roadmaps.json";
    private static final Set<String> STATION_TYPES = Set.of("start", "station", "junction", "terminus");

    private final RoadmapCatalog catalog;

    public RoadmapService(JsonMapper jsonMapper) throws IOException {
        try (InputStream in = new ClassPathResource(CATALOG_PATH).getInputStream()) {
            this.catalog = jsonMapper.readValue(in, RoadmapCatalog.class);
        }
        validate(catalog);
    }

    public RoadmapCatalog catalog() {
        return catalog;
    }

    public List<Roadmap> roadmaps() {
        return catalog.roadmaps();
    }

    public Optional<Roadmap> find(String id) {
        return catalog.roadmaps().stream().filter(r -> r.id().equals(id)).findFirst();
    }

    static void validate(RoadmapCatalog catalog) {
        if (catalog.roadmaps() == null || catalog.roadmaps().isEmpty()) {
            throw new IllegalStateException("Roadmap catalog has no roadmaps");
        }
        for (Roadmap r : catalog.roadmaps()) {
            var s = r.scores();
            for (int score : new int[] {s.demand(), s.compensation(), s.aiProof(), s.irreplaceable()}) {
                if (score < 1 || score > 10) {
                    throw new IllegalStateException(r.id() + ": scores must be 1-10, got " + score);
                }
            }
            if (r.stations() == null || r.stations().size() < 3) {
                throw new IllegalStateException(r.id() + ": a line needs at least 3 stations");
            }
            if (!"start".equals(r.stations().get(0).type())
                    || !"terminus".equals(r.stations().get(r.stations().size() - 1).type())) {
                throw new IllegalStateException(r.id() + ": a line must begin at a start and end at a terminus");
            }
            r.stations().forEach(st -> {
                if (!STATION_TYPES.contains(st.type())) {
                    throw new IllegalStateException(r.id() + "/" + st.id() + ": unknown station type " + st.type());
                }
            });
        }
    }
}
