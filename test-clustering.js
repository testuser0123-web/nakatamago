"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// test-clustering.ts
var clustering_1 = require("./app/lib/clustering");
console.log("--- Starting Clustering Test with Dummy Data ---");
// 1. Define a small, controlled set of IDs
var dummyIds = ["ID_A", "ID_B", "ID_C", "ID_D", "ID_E", "ID_F"];
// 2. Manually create a dummy Jaccard distance matrix for these IDs.
//    This matrix is designed to force multiple clusters.
//    Distances are between 0 and 1.
//    Let's aim for 2-3 clusters.
//    Example:
//    Cluster 1: ID_A, ID_B (very close)
//    Cluster 2: ID_C, ID_D (very close)
//    Cluster 3: ID_E, ID_F (moderately close, but distinct from others)
//    Between clusters: high distance
var dummyDistanceMatrix = [
    // ID_A ID_B ID_C ID_D ID_E ID_F
    [0.0, 0.1, 0.9, 0.8, 0.7, 0.7], // ID_A
    [0.1, 0.0, 0.8, 0.9, 0.7, 0.7], // ID_B
    [0.9, 0.8, 0.0, 0.1, 0.8, 0.8], // ID_C
    [0.8, 0.9, 0.1, 0.0, 0.8, 0.8], // ID_D
    [0.7, 0.7, 0.8, 0.8, 0.0, 0.2], // ID_E
    [0.7, 0.7, 0.8, 0.8, 0.2, 0.0], // ID_F
];
console.log("Dummy IDs:", dummyIds);
console.log("Dummy Distance Matrix:", dummyDistanceMatrix);
// 3. Call performHAC and performDBSCAN with these dummy IDs and matrix.
console.log("\n--- Testing HAC ---");
try {
    var hacResult = (0, clustering_1.performHAC)(dummyIds, dummyDistanceMatrix);
    console.log("HAC Result:", hacResult);
    if (hacResult.length > 1) {
        console.log("HAC produced multiple clusters. SUCCESS!");
    }
    else {
        console.log("HAC produced a single cluster or no clusters. FAILURE.");
    }
}
catch (error) {
    console.error("Error during HAC:", error);
}
console.log("\n--- Testing DBSCAN ---");
try {
    var dbscanResult = (0, clustering_1.performDBSCAN)(dummyIds, dummyDistanceMatrix);
    console.log("DBSCAN Result:", dbscanResult);
    if (dbscanResult.length > 1) {
        console.log("DBSCAN produced multiple clusters. SUCCESS!");
    }
    else if (dbscanResult.length === 1 && dbscanResult[0].length === dummyIds.length) {
        console.log("DBSCAN produced a single cluster. FAILURE.");
    }
    else if (dbscanResult.length === 0) {
        console.log("DBSCAN produced no clusters (all noise). FAILURE.");
    }
    else {
        console.log("DBSCAN produced some clusters. SUCCESS!");
    }
}
catch (error) {
    console.error("Error during DBSCAN:", error);
}
console.log("\n--- Clustering Test Finished ---");
