import { computed } from 'vue'
import { createResource } from 'frappe-ui'

// TATVA: the ONE frontend source for what a workflow node type is.
let _resource = null

function nodeTypeResource() {
  if (!_resource) {
    _resource = createResource({
      url: 'tatva_connect.workflow_engine.registry.node_types',
      cache: 'tatva:workflow-node-types',
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

  // The edge names a node may have, given its config — the backend validator's own rule.
  function outputsFor(type, config) {
    const declared = declarationFor(type)
    if (!declared) return []
    if (declared.outputs) return declared.outputs
    const rule = declared.outputs_by
    if (!rule) return []
    return rule.map?.[config?.[rule.field]] || []
  }

  return { resource, nodeTypes, nodeTypesReady, declarationFor, configFieldsFor, outputsFor }
}
