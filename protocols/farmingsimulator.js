import Core from './core.js'
import { XMLParser, XMLValidator } from 'fast-xml-parser'

export default class farmingsimulator extends Core {
  async run (state) {
    if (!this.options.port) this.options.port = 8080
    if (!this.options.token) throw new Error(`No token provided. You can get it from http://${this.options.host}:${this.options.port}/settings.html`)

    const request = await this.request({
      url: `http://${this.options.host}:${this.options.port}/feed/dedicated-server-stats.xml?code=${this.options.token}`,
      responseType: 'text'
    })

    const isValidXML = XMLValidator.validate(request)
    if (!isValidXML) {
      throw new Error('Invalid XML received from Farming Simulator Server')
    }

    const parser = new XMLParser({ ignoreAttributes: false })
    const parsed = parser.parse(request)

    const serverInfo = parsed.Server
    const playerInfo = serverInfo.Slots

    // Attributes in fast-xml-parser are prefixed with @_

    state.name = serverInfo['@_name']
    state.map = serverInfo['@_mapName']
    state.numplayers = parseInt(playerInfo['@_numUsed'], 10) || 0
    state.maxplayers = parseInt(playerInfo['@_capacity'], 10) || 0

const players = playerInfo.Player || []
const vehicles = serverInfo?.Vehicles?.Vehicle || []

for (const player of players) {
  if (player['@_isUsed'] !== 'true') continue

  let x = parseFloat(player['@_x'])
  let y = parseFloat(player['@_y'])
  let z = parseFloat(player['@_z'])
  let in_machine = false
  let machine_name = null

  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    in_machine = true
    const vehicle = vehicles.find(v => v['@_controller'] === player['#text'])
    if (vehicle) {
      x = parseFloat(vehicle['@_x']) || null
      y = parseFloat(vehicle['@_y']) || null
      z = parseFloat(vehicle['@_z']) || null
      machine_name = vehicle['@_name'] || null
    } else {
      x = y = z = null
    }
  }

  state.players.push({
    name: player['#text'],
    isUsed: true,
    isAdmin: player['@_isAdmin'] === 'true',
    uptime: parseInt(player['@_uptime'], 10),
    in_machine,
    machine_name,
    x,
    y,
    z
  })
}

   state.rawdata = request
   state.raw.mods = []

    const mods = serverInfo?.Mods?.Mod || [];

    for (const mod of mods) {
      if (mod['@_name'] == null) { continue }

      state.raw.mods.push({
        name: mod['#text'],
        short_name: mod['@_name'],
        author: mod['@_author'],
        version: mod['@_version'],
        hash: mod['@_hash']
      })
    }

    state.version = serverInfo['@_version']
  }
}
