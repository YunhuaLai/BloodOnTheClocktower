const analysisCache = new Map();

function getAnalysisSignature(game) {
  return JSON.stringify(game);
}

async function fetchWorldlineAnalysis(game) {
  const response = await fetch("/api/deduction/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ game }),
  });

  if (!response.ok) {
    throw new Error(`Analysis API returned ${response.status}`);
  }

  return response.json();
}

export function getCachedWorldlineAnalysis(game) {
  const cached = analysisCache.get(getAnalysisSignature(game));
  return cached?.status === "fulfilled" ? cached.analysis : null;
}

export function loadWorldlineAnalysis(game) {
  const signature = getAnalysisSignature(game);
  const cached = analysisCache.get(signature);

  if (cached?.status === "fulfilled") {
    return Promise.resolve(cached.analysis);
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = fetchWorldlineAnalysis(game).then(
    (analysis) => {
      analysisCache.set(signature, { status: "fulfilled", analysis });
      return analysis;
    },
    (error) => {
      analysisCache.delete(signature);
      throw error;
    },
  );

  analysisCache.set(signature, { status: "pending", promise });
  return promise;
}
