/**
 * POST /api/v1/journal-insights
 *
 * Analyzes a user's strain journal entries using Workers AI (Llama 3.3 70B)
 * and returns personalized insights about their usage patterns, preferences,
 * and recommendations.
 *
 * Inspired by: strain-tracker's /ai/insights endpoint + prompts.py
 */

export async function onRequestPost(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { entries, period } = await context.request.json();

    if (!entries || !Array.isArray(entries) || entries.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Need at least 2 journal entries for insights' }),
        { status: 400, headers }
      );
    }

    /* ------------------------------------------------------------------ */
    /*  Build rich context from journal entries                            */
    /* ------------------------------------------------------------------ */

    // Filter by period if specified
    let filtered = entries;
    if (period && period !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (period === 'week') cutoff.setDate(now.getDate() - 7);
      else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
      else if (period === '3months') cutoff.setMonth(now.getMonth() - 3);
      filtered = entries.filter(e => new Date(e.date || e.createdAt) >= cutoff);
      if (filtered.length < 2) filtered = entries; // fall back to all
    }

    // Compute statistics
    const totalSessions = filtered.length;
    const uniqueStrains = new Set(filtered.map(e => e.strainName?.toLowerCase())).size;
    const avgRating = (filtered.reduce((s, e) => s + (e.rating || 0), 0) / totalSessions).toFixed(1);

    // Type breakdown
    const typeCounts = {};
    filtered.forEach(e => {
      const t = e.strainType || 'unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    // Method breakdown
    const methodCounts = {};
    filtered.forEach(e => {
      const m = e.method || 'other';
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    });

    // Effect frequency
    const effectCounts = {};
    filtered.forEach(e => {
      (e.effects || []).forEach(eff => {
        effectCounts[eff] = (effectCounts[eff] || 0) + 1;
      });
    });
    const topEffects = Object.entries(effectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([eff, count]) => `${eff} (${count}x)`);

    // Negative effect frequency
    const negCounts = {};
    filtered.forEach(e => {
      (e.negativeEffects || []).forEach(eff => {
        negCounts[eff] = (negCounts[eff] || 0) + 1;
      });
    });
    const topNegatives = Object.entries(negCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([eff, count]) => `${eff} (${count}x)`);

    // Flavor frequency
    const flavorCounts = {};
    filtered.forEach(e => {
      (e.flavors || []).forEach(f => {
        flavorCounts[f] = (flavorCounts[f] || 0) + 1;
      });
    });
    const topFlavors = Object.entries(flavorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([f, count]) => `${f} (${count}x)`);

    // Top-rated strains
    const strainRatings = {};
    const strainCounts = {};
    filtered.forEach(e => {
      const name = e.strainName;
      if (!name) return;
      strainRatings[name] = (strainRatings[name] || 0) + (e.rating || 0);
      strainCounts[name] = (strainCounts[name] || 0) + 1;
    });
    const topStrains = Object.entries(strainRatings)
      .map(([name, total]) => ({
        name,
        avg: (total / strainCounts[name]).toFixed(1),
        count: strainCounts[name],
      }))
      .sort((a, b) => b.avg - a.avg || b.count - a.count)
      .slice(0, 5);

    // Would-try-again ratio
    const tryAgainEntries = filtered.filter(e => e.wouldTryAgain !== undefined);
    const tryAgainYes = tryAgainEntries.filter(e => e.wouldTryAgain).length;
    const tryAgainRatio = tryAgainEntries.length > 0
      ? `${tryAgainYes}/${tryAgainEntries.length} (${Math.round(100 * tryAgainYes / tryAgainEntries.length)}%)`
      : 'not tracked';

    // Context/setting frequency
    const contextCounts = {};
    filtered.forEach(e => {
      if (e.context) contextCounts[e.context] = (contextCounts[e.context] || 0) + 1;
    });
    const topContexts = Object.entries(contextCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([ctx, count]) => `${ctx} (${count}x)`);

    // Build individual session log lines (most recent 30)
    const recentSessions = filtered
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      .slice(0, 30)
      .map(e => {
        const parts = [
          `${(e.date || e.createdAt || '').slice(0, 10)}: ${e.strainName} (${e.strainType || '?'}) — ${e.rating}/5 via ${e.method || '?'}`,
        ];
        if (e.effects?.length) parts.push(`effects: ${e.effects.join(', ')}`);
        if (e.negativeEffects?.length) parts.push(`negatives: ${e.negativeEffects.join(', ')}`);
        if (e.dosage) parts.push(`dose: ${e.dosage}`);
        if (e.context) parts.push(`setting: ${e.context}`);
        if (e.wouldTryAgain !== undefined) parts.push(e.wouldTryAgain ? '👍 would try again' : '👎 would NOT try again');
        if (e.notes) parts.push(`notes: ${e.notes.slice(0, 100)}`);
        return parts.join(' | ');
      });

    /* ------------------------------------------------------------------ */
    /*  Build AI prompt                                                   */
    /* ------------------------------------------------------------------ */

    const systemPrompt = `You are Strain AI, a cannabis usage analyst and wellness advisor. Analyze the user's strain journal data and provide actionable, personalized insights about their usage patterns, preferences, and health-conscious recommendations.

Be specific — reference actual strain names, ratings, effects, and terpene data from their journal. Make practical suggestions. Keep the tone warm but professional.

Structure your response in these sections:
## 📊 Usage Overview
Brief summary of their consumption patterns (frequency, variety, preferred methods).

## 🌟 What's Working
What strains and patterns correlate with their highest ratings and best experiences. Identify terpene and effect patterns they consistently enjoy.

## ⚠️ Watch Out For
Negative effect patterns, strains that didn't work well, any usage patterns worth being mindful of.

## 💡 Recommendations
3-4 specific, actionable suggestions: strains to revisit, consumption adjustments, new types/effects to explore based on their preferences.

## 🔮 Patterns & Trends
Interesting correlations: time of day preferences, method-rating relationships, how their taste has evolved.

Keep the total response under 500 words. Use bullet points for clarity.`;

    const userPrompt = `Here is my strain journal data:

**Summary:**
- Total sessions: ${totalSessions}
- Unique strains: ${uniqueStrains}
- Average rating: ${avgRating}/5
- Would try again: ${tryAgainRatio}
- Type breakdown: ${Object.entries(typeCounts).map(([t, c]) => `${t}: ${c}`).join(', ')}
- Method breakdown: ${Object.entries(methodCounts).map(([m, c]) => `${m}: ${c}`).join(', ')}
- Top effects enjoyed: ${topEffects.join(', ') || 'none tracked'}
- Negative effects reported: ${topNegatives.join(', ') || 'none tracked'}
- Favorite flavors: ${topFlavors.join(', ') || 'none tracked'}
- Preferred settings: ${topContexts.join(', ') || 'none tracked'}

**Top-rated strains:**
${topStrains.map(s => `- ${s.name}: ${s.avg}/5 (${s.count} session${s.count > 1 ? 's' : ''})`).join('\n')}

**Recent session log (${recentSessions.length} sessions):**
${recentSessions.join('\n')}

Please analyze my journal and give me personalized insights.`;

    /* ------------------------------------------------------------------ */
    /*  Call Workers AI                                                   */
    /* ------------------------------------------------------------------ */

    const ai = context.env.AI;
    if (!ai) {
      // Fallback: return stats-only summary without AI
      return new Response(
        JSON.stringify({
          insights: `## 📊 Journal Summary\n\n- **${totalSessions}** sessions across **${uniqueStrains}** strains\n- Average rating: **${avgRating}/5**\n- Top effects: ${topEffects.slice(0, 5).join(', ') || 'none yet'}\n- Most-used strains: ${topStrains.slice(0, 3).map(s => `${s.name} (${s.avg}★)`).join(', ') || 'none yet'}\n\n*AI analysis unavailable — add more entries to unlock deeper insights.*`,
          stats: { totalSessions, uniqueStrains, avgRating, topEffects, topStrains, typeCounts, methodCounts },
        }),
        { status: 200, headers }
      );
    }

    const aiResponse = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const insights = aiResponse?.response || aiResponse?.result?.response || 'Unable to generate insights at this time.';

    return new Response(
      JSON.stringify({
        insights,
        stats: { totalSessions, uniqueStrains, avgRating, topEffects, topStrains, typeCounts, methodCounts },
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to generate insights', detail: err.message }),
      { status: 500, headers }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
