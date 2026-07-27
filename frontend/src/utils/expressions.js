/**
 * Pure expression evaluation helpers.
 * Extracted from utils/index.js to be independently importable
 * without pulling in UI dependencies (icons, components, etc.).
 */

// A compiled expression, keyed by the source it was compiled from. `new Function` is a JIT compile, and an
// activity form re-asks the same handful of conditions on every keystroke — so without this the same dozen
// expressions are recompiled dozens of times per character typed. The source and the argument names fully
// determine the function, so a hit is always the same function a miss would have built.
const compiled = new Map()

export function _eval(code, context = {}) {
  let variable_names = Object.keys(context)
  let variables = Object.values(context)
  code = `let out = ${code}; return out`
  let key = `${variable_names.join(',')}|${code}`
  try {
    let expression_function = compiled.get(key)
    if (!expression_function) {
      expression_function = new Function(...variable_names, code)
      compiled.set(key, expression_function)
    }
    return expression_function(...variables)
  } catch (error) {
    console.log('Error evaluating the following expression:')
    console.error(code)
    throw error
  }
}

export function evaluateDependsOnValue(expression, doc) {
  if (!expression) return true
  if (!doc) return true

  let out

  if (typeof expression === 'boolean') {
    out = expression
  } else if (typeof expression === 'function') {
    out = expression(doc)
  } else if (expression.substr(0, 5) == 'eval:') {
    try {
      out = _eval(expression.substr(5), { doc })
    } catch {
      out = true
    }
  } else {
    let value = doc[expression]
    if (Array.isArray(value)) {
      out = !!value.length
    } else {
      out = !!value
    }
  }

  return out
}

export function evaluateExpression(expression, doc, parent) {
  if (!expression) return false
  if (!doc) return false

  let out
  if (typeof expression === 'boolean') {
    out = expression
  } else if (typeof expression === 'function') {
    out = expression(doc)
  } else if (expression.substr(0, 5) == 'eval:') {
    try {
      out = _eval(expression.substr(5), { doc, parent })
      if (parent && parent.istable && expression.includes('is_submittable')) {
        out = true
      }
    } catch {
      out = true
    }
  } else {
    let value = doc[expression]
    if (Array.isArray(value)) {
      out = !!value.length
    } else {
      out = !!value
    }
  }

  return out
}
