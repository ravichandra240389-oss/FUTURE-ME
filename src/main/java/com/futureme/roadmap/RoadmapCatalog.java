package com.futureme.roadmap;

import java.util.List;

/** Root of {@code data/roadmaps.json}: the profile being planned for and the career lines on offer. */
public record RoadmapCatalog(Profile profile, String asOf, String disclaimer, List<Roadmap> roadmaps) {

    public record Profile(String name, String title, int yearsOfExperience, String location, List<String> skills) {}

    /** One career line. Scores are 1-10. */
    public record Roadmap(
            String id,
            String title,
            String tagline,
            String color,
            Scores scores,
            Compensation compensation,
            String whyNow,
            List<String> leverage,
            List<String> gaps,
            List<String> targetRoles,
            List<Station> stations) {}

    public record Scores(int demand, int compensation, int aiProof, int irreplaceable) {}

    /** Display ranges, e.g. "₹55–90 LPA". */
    public record Compensation(String india, String global) {}

    /** A stop on the line. {@code type} is one of start, station, junction, terminus. */
    public record Station(
            String id,
            String name,
            String type,
            String duration,
            String summary,
            List<String> topics,
            String milestone) {}
}
