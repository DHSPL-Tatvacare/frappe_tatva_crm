// TATVA: the editor's `field_catalog` request for a draft scope; a saved view's list asks by the view's name instead.
export function catalogParams(scope) {
  return {
    base_object: scope.base_object,
    activity_type: scope.base_object === 'Activity' ? scope.activity_type || undefined : undefined,
    vertical: scope.vertical || undefined,
    group: scope.group || undefined,
    program: scope.program || undefined,
  }
}
