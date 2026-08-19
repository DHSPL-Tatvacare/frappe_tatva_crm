// TATVA: one node's slice of the graph's authoring answer — the JS side of `context.for_node`.
// The halves come down apart because only one moves: `subject_fields` is the Trigger's schema and is identical at every node, `emitted` is what this node's ancestors write.
// A plain concat, because a ref is `<source>.<field>` and a node's source is its node id while the subject's is a doctype slug — `test_one_context_answer` asserts that disjointness rather than assuming it.
export function contextFor(answer, nodeId) {
  const positional = answer?.nodes?.[nodeId]
  // A node the answer does not hold yet — a box just dropped, before the reload lands.
  if (!positional) return null
  return {
    subject: answer.subject,
    grain: answer.grain,
    working_set: answer.working_set,
    variables: [...positional.emitted, ...answer.subject_fields],
    emitters: positional.emitters,
    settable: answer.settable,
    // What a Target may offer, and which record THIS node writes — both server-answered, and both must be
    // carried here or the control that reads them silently renders empty. `for_node` returns the same pair.
    targets: answer.targets,
    writes_to: positional.writes_to,
    operators_by_type: answer.operators_by_type,
    operator_shapes: answer.operator_shapes,
  }
}
