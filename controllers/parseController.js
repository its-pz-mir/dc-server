const { parseAddressWithAI } = require('../utils/aiParser');

exports.parseAndValidateAddress = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        status: "INVALID_INPUT", 
        message: "Please enter a property location or address to search." 
      });
    }

    // Call Gemini AI for validation and cleaning
    const parsedData = await parseAddressWithAI(query);

    if (!parsedData.is_valid_location) {
      return res.json({
        status: "INVALID_LOCATION",
        message: parsedData.message || "Please provide a valid area, road, or neighborhood name (e.g., Islampura, Outfall Road, Gulberg)."
      });
    }

    return res.json({
      status: "SUCCESS",
      data: parsedData
    });

  } catch (error) {
    console.error("Parse Controller Error:", error);
    if (error.isAiError || error.status === 503) {
      return res.status(503).json({
        status: "AI_TEMPORARILY_UNAVAILABLE",
        message:
          "Google AI is currently experiencing high demand. Please try again in a few moments."
      });
    }
    res.status(500).json({ error: "Failed to process address input." });
  }
};