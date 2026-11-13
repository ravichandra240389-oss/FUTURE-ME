package com.futureme.roadmap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class RoadmapControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    RoadmapService service;

    @Test
    void catalogLoadsAndPassesValidation() {
        assertThat(service.roadmaps()).hasSizeGreaterThanOrEqualTo(6);
        assertThat(service.roadmaps()).extracting(r -> r.id()).doesNotHaveDuplicates();
    }

    @Test
    void servesCatalog() throws Exception {
        mvc.perform(get("/api/catalog"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.yearsOfExperience").value(16))
                .andExpect(jsonPath("$.roadmaps[0].stations[0].type").value("start"));
    }

    @Test
    void servesOneRoadmapOr404() throws Exception {
        String id = service.roadmaps().get(0).id();
        mvc.perform(get("/api/roadmaps/" + id)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(get("/api/roadmaps/no-such-line")).andExpect(status().isNotFound());
    }

    @Test
    void servesTheSite() throws Exception {
        mvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("class=\"site-header\"")))
                .andExpect(content().string(containsString("<footer class=\"site-footer\"")));
    }
}
