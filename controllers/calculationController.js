const mongoose = require('mongoose');
const {
  getPropertyModel,
  isSupportedClassification
} = require('../models/propertyModel');

exports.calculateValuation = async (req, res) => {
  try {
    const {
      classification,
      property_id,
      kanal = 0,
      marla = 0,
      sqft_land = 0,
      covered_area_sqft = 0
    } = req.body;

    if (!isSupportedClassification(classification) || !property_id) {
      return res.status(400).json({ error: "A valid classification and property_id are required." });
    }
    if (!mongoose.isValidObjectId(property_id)) {
      return res.status(400).json({ error: "property_id must be a valid record ID." });
    }

    const numericInputs = {
      kanal: Number(kanal),
      marla: Number(marla),
      sqft_land: Number(sqft_land),
      covered_area_sqft: Number(covered_area_sqft)
    };
    if (Object.values(numericInputs).some((value) => !Number.isFinite(value) || value < 0)) {
      return res.status(400).json({ error: "Area values must be valid non-negative numbers." });
    }

    const PropertyModel = getPropertyModel(classification);
    const record = await PropertyModel.findById(property_id);

    if (!record) {
      return res.status(404).json({ error: "Record nahi mila." });
    }

    // Convert Kanal + Marla + Sq.Ft into Total Marlas
    // (Standard Punjab Real Estate Unit: 1 Kanal = 20 Marlas, 1 Marla = 225 Sq.Ft)
    const totalMarla =
      (numericInputs.kanal * 20) +
      numericInputs.marla +
      (numericInputs.sqft_land / 225);
    const coveredSqft = numericInputs.covered_area_sqft;

    const ratePerMarla = record.rate_per_unit || 0;
    const structureRateSqft = record.construction_rate_sqft || 0;

    const totalLandValue = totalMarla * ratePerMarla;
    const totalConstructionValue = coveredSqft * structureRateSqft;
    const finalDcValuation = totalLandValue + totalConstructionValue;

    return res.json({
      status: "SUCCESS",
      matched_location: {
        tehsil: record.tehsil,
        town: record.town,
        revenue_circle: record.revenue_circle,
        property_area: record.property_area,
        location_road: record.location_road,
        unit: record.unit || "Marla"
      },
      area_details: {
        input_kanal: kanal,
        input_marla: marla,
        input_sqft_land: sqft_land,
        total_calculated_marla: totalMarla.toFixed(2),
        covered_area_sqft: coveredSqft
      },
      breakdown: {
        rate_per_marla: ratePerMarla,
        land_area_marla: totalMarla,
        total_land_value: totalLandValue,
        construction_rate_sqft: structureRateSqft,
        covered_area_sqft: coveredSqft,
        total_construction_value: totalConstructionValue,
        final_dc_valuation: finalDcValuation
      }
    });

  } catch (error) {
    console.error("Calculation Error:", error);
    res.status(500).json({ error: "Calculation process failed." });
  }
};