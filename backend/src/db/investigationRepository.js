import { query } from './connection.js';

/**
 * Ensures an investigation record exists or creates one.
 * Enforces ownership: if investigationId belongs to another user, throws 403 Forbidden.
 * @param {string} [investigationId]
 * @param {string} [title]
 * @param {string} [userId]
 * @returns {Promise<string>} Active investigation ID
 */
export async function findOrCreateInvestigation(investigationId, title = 'New Investigation', userId = null) {
  try {
    if (investigationId) {
      const existing = await query('SELECT id, user_id FROM investigations WHERE id = $1', [investigationId]);
      if (existing.rows?.length > 0) {
        const inv = existing.rows[0];
        // Enforce ownership if investigation is owned by another user
        if (inv.user_id && userId && inv.user_id !== userId) {
          const authErr = new Error('Forbidden: You do not have permission to access or modify this investigation.');
          authErr.status = 403;
          throw authErr;
        }
        // If investigation was previously unassigned and a user is now active, claim it
        if (!inv.user_id && userId) {
          await query('UPDATE investigations SET user_id = $1 WHERE id = $2', [userId, inv.id]);
        }
        return inv.id;
      }
    }

    const res = await query(
      `INSERT INTO investigations (id, user_id, title, status, created_at, updated_at)
       VALUES (COALESCE($1, gen_random_uuid()::text), $2, $3, 'active', NOW(), NOW())
       RETURNING id`,
      [investigationId || null, userId || null, title]
    );

    return res.rows[0]?.id;
  } catch (err) {
    if (err.status === 403) {
      throw err;
    }
    console.warn('[Repository] Failed to findOrCreateInvestigation:', err.message);
    return investigationId || 'ephemeral-investigation';
  }
}

/**
 * Persists a message to the database.
 * @param {object} params
 * @param {string} params.investigationId
 * @param {string} params.role 'user' | 'assistant' | 'system'
 * @param {string} params.content
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @returns {Promise<string|null>} Message ID
 */
export async function saveMessage({ investigationId, role, content, provider = null, model = null }) {
  try {
    const res = await query(
      `INSERT INTO messages (investigation_id, role, content, provider, model, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [investigationId, role, content, provider, model]
    );
    return res.rows[0]?.id || null;
  } catch (err) {
    console.warn('[Repository] Failed to saveMessage:', err.message);
    return null;
  }
}

/**
 * Persists an evidence item to the database.
 * @param {object} params
 * @param {string} params.investigationId
 * @param {string} params.source 'mcp' | 'rag' | 'manual' | 'log'
 * @param {string} params.content
 * @param {object} [params.metadata]
 * @returns {Promise<string|null>} Evidence ID
 */
export async function saveEvidence({ investigationId, source, content, metadata = {} }) {
  try {
    const res = await query(
      `INSERT INTO evidence (investigation_id, source, content, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [investigationId, source, content, JSON.stringify(metadata)]
    );
    return res.rows[0]?.id || null;
  } catch (err) {
    console.warn('[Repository] Failed to saveEvidence:', err.message);
    return null;
  }
}

/**
 * Persists a diagnostic report to the database.
 * @param {object} params
 * @param {string} params.investigationId
 * @param {string} [params.finding]
 * @param {string} [params.rootCause]
 * @param {string} [params.confidence]
 * @param {any[]} [params.evidenceRefs]
 * @returns {Promise<string|null>} Diagnostic report ID
 */
export async function saveDiagnosticReport({ investigationId, finding, rootCause, confidence, evidenceRefs = [] }) {
  try {
    const res = await query(
      `INSERT INTO diagnostic_reports (investigation_id, finding, root_cause, confidence, evidence_refs, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [investigationId, finding || null, rootCause || null, confidence || null, JSON.stringify(evidenceRefs)]
    );
    return res.rows[0]?.id || null;
  } catch (err) {
    console.warn('[Repository] Failed to saveDiagnosticReport:', err.message);
    return null;
  }
}

/**
 * Records request usage telemetry to the database.
 * @param {object} params
 * @param {string} params.investigationId
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {number} [params.inputTokens]
 * @param {number} [params.outputTokens]
 * @param {number} [params.toolCalls]
 * @param {number} [params.ragChunks]
 * @param {number} [params.latencyMs]
 * @param {string} [params.status]
 * @returns {Promise<string|null>} Usage metadata ID
 */
export async function saveUsageMetadata({
  investigationId,
  provider = 'unknown',
  model = null,
  inputTokens = 0,
  outputTokens = 0,
  toolCalls = 0,
  ragChunks = 0,
  latencyMs = 0,
  status = 'success'
}) {
  try {
    const res = await query(
      `INSERT INTO usage_metadata (investigation_id, provider, model, input_tokens, output_tokens, tool_calls, rag_chunks, latency_ms, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id`,
      [investigationId, provider, model, inputTokens, outputTokens, toolCalls, ragChunks, latencyMs, status]
    );
    return res.rows[0]?.id || null;
  } catch (err) {
    console.warn('[Repository] Failed to saveUsageMetadata:', err.message);
    return null;
  }
}

/**
 * Persists an entire chat turn (User message, Assistant response, Evidence, Diagnostic findings, Usage metadata).
 * @param {object} params
 * @param {string} [params.investigationId]
 * @param {string} [params.userId]
 * @param {string} params.userMessage
 * @param {object} params.assistantResult
 * @param {number} [params.latencyMs]
 * @returns {Promise<{ investigationId: string }>}
 */
export async function recordChatInteraction({
  investigationId = null,
  userId = null,
  userMessage,
  assistantResult,
  latencyMs = 0
}) {
  try {
    const activeInvId = await findOrCreateInvestigation(
      investigationId,
      userMessage.slice(0, 60) || 'Investigation',
      userId
    );

    // 1. Save User Message
    await saveMessage({
      investigationId: activeInvId,
      role: 'user',
      content: userMessage
    });

    const meta = assistantResult?.metadata || {};

    // 2. Save Assistant Response Message
    await saveMessage({
      investigationId: activeInvId,
      role: 'assistant',
      content: assistantResult?.answer || '',
      provider: meta.provider || null,
      model: meta.model || null
    });

    // 3. Save Evidence if present
    if (meta.inspectedPaths?.length > 0) {
      await saveEvidence({
        investigationId: activeInvId,
        source: 'internal_mcp',
        content: `Inspected ${meta.inspectedPaths.length} repository path(s)`,
        metadata: { paths: meta.inspectedPaths }
      });
    }

    if (Array.isArray(meta.externalEvidence)) {
      for (const ev of meta.externalEvidence) {
        const sourceTag = ev.source ? `${ev.source.toLowerCase().replace(/[^a-z0-9]/g, '_')}_mcp` : 'external_mcp';
        await saveEvidence({
          investigationId: activeInvId,
          source: sourceTag,
          content: ev.summary || `${ev.source || 'External'} MCP evidence gathered`,
          metadata: {
            tool: ev.tool,
            payload: ev.payload
          }
        });
      }
    }

    if (meta.debuggingMatches?.length > 0) {
      await saveEvidence({
        investigationId: activeInvId,
        source: 'rag',
        content: 'Debugging knowledge base matches',
        metadata: { matches: meta.debuggingMatches }
      });
    }

    if (meta.logEvidence && (meta.logEvidence.errorType || meta.logEvidence.framesReferenced?.length > 0)) {
      await saveEvidence({
        investigationId: activeInvId,
        source: 'log_mcp',
        content: `Error log: ${meta.logEvidence.errorType || 'Exception'}`,
        metadata: meta.logEvidence
      });
    }

    // 4. Save Usage telemetry
    await saveUsageMetadata({
      investigationId: activeInvId,
      provider: meta.provider || 'unknown',
      model: meta.model || null,
      inputTokens: meta.usage?.prompt_tokens || 0,
      outputTokens: meta.usage?.completion_tokens || 0,
      toolCalls: meta.toolCallsUsed || 0,
      ragChunks: meta.contextFound ? 1 : 0,
      latencyMs,
      status: assistantResult?.success ? 'success' : 'error'
    });

    // Update investigation updated_at timestamp
    await query('UPDATE investigations SET updated_at = NOW() WHERE id = $1', [activeInvId]);

    return { investigationId: activeInvId };
  } catch (err) {
    if (err.status === 403) {
      throw err;
    }
    console.warn('[Repository] recordChatInteraction non-fatal error:', err.message);
    return { investigationId: investigationId || 'ephemeral-investigation' };
  }
}

/**
 * Retrieves a single investigation by ID, strictly enforcing user ownership (anti-IDOR).
 * @param {string} investigationId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getInvestigation(investigationId, userId) {
  const res = await query('SELECT * FROM investigations WHERE id = $1', [investigationId]);
  if (!res.rows || res.rows.length === 0) {
    const err = new Error('Investigation not found.');
    err.status = 404;
    throw err;
  }
  const inv = res.rows[0];
  if (inv.user_id && userId && inv.user_id !== userId) {
    const err = new Error('Forbidden: You do not have permission to access this investigation.');
    err.status = 403;
    throw err;
  }
  return inv;
}

/**
 * Lists all investigations belonging to a specific user.
 * @param {string} userId
 * @returns {Promise<any[]>}
 */
export async function listUserInvestigations(userId) {
  if (!userId) return [];
  const res = await query(
    `SELECT i.*,
       (SELECT COUNT(*) FROM messages m WHERE m.investigation_id = i.id) as message_count,
       (SELECT COUNT(*) FROM evidence e WHERE e.investigation_id = i.id) as evidence_count
     FROM investigations i
     WHERE i.user_id = $1
     ORDER BY i.updated_at DESC`,
    [userId]
  );
  return res.rows || [];
}

/**
 * Retrieves messages for an investigation after verifying ownership.
 * @param {string} investigationId
 * @param {string} userId
 * @returns {Promise<any[]>}
 */
export async function getInvestigationMessages(investigationId, userId) {
  await getInvestigation(investigationId, userId);
  const res = await query(
    'SELECT * FROM messages WHERE investigation_id = $1 ORDER BY created_at ASC',
    [investigationId]
  );
  return res.rows || [];
}

/**
 * Retrieves evidence items for an investigation after verifying ownership.
 * @param {string} investigationId
 * @param {string} userId
 * @returns {Promise<any[]>}
 */
export async function getInvestigationEvidence(investigationId, userId) {
  await getInvestigation(investigationId, userId);
  const res = await query(
    'SELECT * FROM evidence WHERE investigation_id = $1 ORDER BY created_at ASC',
    [investigationId]
  );
  return res.rows || [];
}

/**
 * Retrieves diagnostic reports for an investigation after verifying ownership.
 * @param {string} investigationId
 * @param {string} userId
 * @returns {Promise<any[]>}
 */
export async function getInvestigationDiagnosticReport(investigationId, userId) {
  await getInvestigation(investigationId, userId);
  const res = await query(
    'SELECT * FROM diagnostic_reports WHERE investigation_id = $1 ORDER BY created_at DESC',
    [investigationId]
  );
  return res.rows || [];
}
