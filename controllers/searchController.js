const { getPropertyModel } = require('../models/propertyModel');
const { parseAddressWithAI } = require('../utils/aiParser');

exports.searchProperties = async (req, res) => {
  try {
    const { classification, query } = req.query;

    if (!classification || !query) {
      return res.status(400).json({ error: "Classification and query parameters are required." });
    }

    const PropertyModel = getPropertyModel(classification);

    // 1. Call AI Parser (Catches 503 explicitly)
    let parsedData;
    try {
      parsedData = await parseAddressWithAI(query);
    } catch (aiErr) {
      if (aiErr.isAiError || aiErr.status === 503) {
        return res.status(503).json({
          status: "AI_TEMPORARILY_UNAVAILABLE",
          message: aiErr.message || "AI server is currently experiencing high demand. Please try again in a few seconds."
        });
      }
      throw aiErr;
    }

    if (!parsedData.is_valid_location) {
      return res.json({
        status: "INVALID_INPUT",
        message: parsedData.message || "Please enter a valid neighborhood or road name (e.g. Islampura, Outfall Road)."
      });
    }

    const keywords = parsedData.search_keywords || [];
    if (keywords.length === 0) {
      return res.json({ 
        status: "NO_MATCH", 
        message: `No valid keywords could be parsed from "${query}".` 
      });
    }

    let candidateMap = new Map(); // Store recordId -> { record, totalScore, matchedKeywords }

    // 2. Multi-Keyword Search Execution (Ensures Sant Nagar AND Islampura both get evaluated)
    for (const kw of keywords) {
      if (!kw || kw.length < 2) continue;

      const regex = new RegExp(kw.trim(), 'i');

      // Search across location_road, property_area, and revenue_circle
      const matchingRows = await PropertyModel.find({
        $or: [
          { location_road: regex },
          { property_area: regex },
          { revenue_circle: regex }
        ]
      }).lean();

      for (const row of matchingRows) {
        const rowId = row._id.toString();
        let keywordScore = 0;
        let matchedFields = [];

        if (row.location_road && regex.test(row.location_road)) {
          keywordScore += 100;
          matchedFields.push("location_road");
        }
        if (row.property_area && regex.test(row.property_area)) {
          keywordScore += 80;
          matchedFields.push("property_area");
        }
        if (row.revenue_circle && regex.test(row.revenue_circle)) {
          keywordScore += 30;
          matchedFields.push("revenue_circle");
        }

        if (!candidateMap.has(rowId)) {
          candidateMap.set(rowId, {
            record: row,
            totalScore: keywordScore,
            matchedKeywords: [kw],
            matchedFields: [...matchedFields]
          });
        } else {
          // Extra boost if a record contains MULTIPLE search keywords (e.g. Both Sant Nagar AND Islampura)
          const existing = candidateMap.get(rowId);
          existing.totalScore += (keywordScore + 50); // Compound Keyword Match Bonus!
          if (!existing.matchedKeywords.includes(kw)) {
            existing.matchedKeywords.push(kw);
          }
        }
      }
    }

    let scoredResults = Array.from(candidateMap.values());

    if (scoredResults.length === 0) {
      return res.json({
        status: "NO_MATCH",
        message: `No official records found for "${parsedData.corrected_address || query}".`
      });
    }

    // 3. Sort Candidates by Total Score
    scoredResults.sort((a, b) => b.totalScore - a.totalScore);

    // 4. Decision Logic: If multiple distinct matches exist for the AI keywords, return NEEDS_CLARIFICATION
    // This guarantees that both Sant Nagar & Islampura matches are presented to the user to choose from.
    if (scoredResults.length > 1) {
      return res.json({
        status: "NEEDS_CLARIFICATION",
        count: scoredResults.length,
        ai_parsed_data: parsedData,
        message: `We found matching areas for your query (${keywords.join(', ')}). Please select your exact location:`,
        options: scoredResults.slice(0, 15).map(item => ({
          id: item.record._id,
          score: item.totalScore,
          matched_keywords: item.matchedKeywords,
          property_area: item.record.property_area,
          revenue_circle: item.record.revenue_circle,
          tehsil: item.record.tehsil,
          location_road: item.record.location_road,
          rate_per_marla: item.record.rate_per_unit || 0,
          construction_rate_sqft: item.record.construction_rate_sqft || 0
        }))
      });
    }

    // Single exact match
    const match = scoredResults[0].record;
    return res.json({
      status: "EXACT_MATCH",
      confidence_score: scoredResults[0].totalScore,
      matched_keywords: scoredResults[0].matchedKeywords,
      ai_parsed_data: parsedData,
      matched_location: {
        id: match._id,
        tehsil: match.tehsil,
        town: match.town,
        revenue_circle: match.revenue_circle,
        property_area: match.property_area,
        location_road: match.location_road,
        rate_per_marla: match.rate_per_unit || 0,
        construction_rate_sqft: match.construction_rate_sqft || 0,
        unit: match.unit || "Marla"
      }
    });

  } catch (error) {
    console.error("Search Controller Error:", error);
    res.status(500).json({ error: error.message || "Internal server error during search." });
  }
};