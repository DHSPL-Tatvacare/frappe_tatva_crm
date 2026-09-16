// TATVA: the one `field_catalog` request both Smart View surfaces send — the list for its view, the editor for its draft.
export function catalogParams(scope) {
  return {
    base_object: scope.base_object,
    activity_type: scope.base_object === 'Activity' ? scope.activity_type || undefined : undefined,
    vertical: scope.vertical || undefined,
    group: scope.group || undefined,
    program: scope.program || undefined,
  }
}
