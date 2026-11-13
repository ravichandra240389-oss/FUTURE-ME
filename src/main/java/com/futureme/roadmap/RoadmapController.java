package com.futureme.roadmap;

import com.futureme.roadmap.RoadmapCatalog.Roadmap;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class RoadmapController {

    private final RoadmapService service;

    public RoadmapController(RoadmapService service) {
        this.service = service;
    }

    /** Whole catalog: profile, disclaimer and every line. The site loads this once. */
    @GetMapping("/catalog")
    public RoadmapCatalog catalog() {
        return service.catalog();
    }

    @GetMapping("/roadmaps/{id}")
    public ResponseEntity<Roadmap> roadmap(@PathVariable String id) {
        return ResponseEntity.of(service.find(id));
    }
}
