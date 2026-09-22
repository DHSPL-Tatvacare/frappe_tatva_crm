import { defineStore } from 'pinia'
import { getCurrentInstance } from 'vue'

export const globalStore = defineStore('crm-global', () => {
  const app = getCurrentInstance()
  const { $dialog, $socket } = app.appContext.config.globalProperties

  let callMethod = () => {}

  function setMakeCall(value) {
    callMethod = value
  }

  // TATVA: the record the call is about travels with the number — its grain decides the line it goes out on.
  function makeCall(number, reference) {
    callMethod(number, reference)
  }

  return {
    $dialog,
    $socket,
    makeCall,
    setMakeCall,
  }
})
