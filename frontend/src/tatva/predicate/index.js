// TATVA: the predicate family's public surface — one import for every host.
//
//     import { PredicateInput } from '@/tatva/predicate'
//
// Shaped the way frappe-ui shapes a family (`components/Dialog/index.ts`): the ROOT is the export, and
// its parts hang off it, so a host that only needs the whole control imports one name while a host that
// wants to compose the pieces itself still can:
//
//     <PredicateInput>                      the whole control
//     <PredicateInput.Group>                one group, if a host lays out its own
//     <PredicateInput.Condition>            one row
//     <PredicateInput.Joiner>               the and/or/none select alone
//
// `predicateTree` is re-exported beside it because a host that saves or reads a tree needs the same
// rules the control edits by — one definition of the shape, not a copy per surface.
import PredicateInputMain from './PredicateInput.vue'
import PredicateGroup from './PredicateGroup.vue'
import PredicateCondition from './PredicateCondition.vue'
import PredicateJoiner from './PredicateJoiner.vue'

const PredicateInput = PredicateInputMain
PredicateInput.Group = PredicateGroup
PredicateInput.Condition = PredicateCondition
PredicateInput.Joiner = PredicateJoiner

export { PredicateInput, PredicateGroup, PredicateCondition, PredicateJoiner }
export * from './predicateTree'
export { PREDICATE_CONTEXT } from './context'
