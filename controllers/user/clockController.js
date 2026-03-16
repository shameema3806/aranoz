const clockController = async (req, res) => {
  try {
    const now = new Date();

    const timeData = {
      hours:   String(now.getHours()).padStart(2, '0'),
      minutes: String(now.getMinutes()).padStart(2, '0'),
      seconds: String(now.getSeconds()).padStart(2, '0'),
      day:     now.toLocaleDateString('en-US', { weekday: 'long' }),
      date:    now.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' }),
    };

    return res.json(timeData);

  } catch (error) {
    console.error("clockController error:", error);
    return res.status(500).json({ error: "Failed to fetch time" });
  }
};

module.exports = { clockController };