import { computed } from 'vue'
import { createResource } from 'frappe-ui'
import { LENS_CACHE_GENERATION } from '@/tatva/lensCache'

// TATVA: the ONE frontend source for what a workflow node type is.
let _resource = null

function nodeTypeResource() {
  if (!_resource) {
    _resource = createResource({
      url: 'tatva_connect.workflow_engine.registry.node_types',
      // A DECLARATION cached with no TTL and mirrored to IndexedDB: without a generation, a browser
      // that loaded the canvas once keeps that table for ever, and a column added on the server never
      // arrives. That is not hypothetical — it shipped, and every card read `Not configured yet`.
      cache: ['tatva:workflow-node-types', LENS_CACHE_GENERATION],
      auto: true,
    })
  }
  return _resource
}

export function useNodeTypes() {
  const resource = nodeTypeResource()
  const nodeTypes = computed(() => resource.data || [])
  // `.fetched`, NOT `!!data`: a cached resource hydrates stale from IndexedDB before the live fetch lands.
  const nodeTypesReady = computed(() => resource.fetched)
  const byType = computed(() => {
    const map = {}
    for (const declared of nodeTypes.value) map[declared.type] = declared
    return map
  })

  function declarationFor(type) {
    return byType.value[type] || null
  }
  function configFieldsFor(type) {
    return declarationFor(type)?.config || []
  }

  // A field gated on another field's value is out of play while that gate is shut — the same question
  // `registry._applies` answers, and the same one `_rows_from` now asks before reading `source_node`.
  // ONE reader for both consumers: the inspector hid a gated field while the node card went on printing
  // its value, so a Wait on a timer said "send-1" for a setting the author could not see.
  function fieldApplies(field, config) {
    const gate = field.depends_on_value
    if (!gate) return true
    return Object.entries(gate).every(([name, values]) =>
      (Array.isArray(values) ? values : [values]).includes(config[name]),
    )
  }

  function appliedFieldsFor(type, config) {
    return configFieldsFor(type).filter((f) => fieldApplies(f, config))
  }

  // No outputsFor here, deliberately. What can leave a node depends on ANOTHER node's config, so it is a
  // whole-graph question and `registry.graph_outputs` is the one that answers it. The JS re-implementation
  // that used to live here rendered zero nodes for a day.
  return {
    resource,
    nodeTypes,
    nodeTypesReady,
    declarationFor,
    configFieldsFor,
    appliedFieldsFor,
  }
}
