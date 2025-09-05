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

    // Podstawowe informacje o serwerze
    state.name = serverInfo['@_name']
    state.map = serverInfo['@_mapName']
    state.numplayers = parseInt(playerInfo['@_numUsed'], 10) || 0
    state.maxplayers = parseInt(playerInfo['@_capacity'], 10) || 0

    // Funkcja do dekodowania encji w atrybutach i nickach
    function decodeEntities(str) {
      if (!str) return str
      return str
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#94;/g, '^')
    }

    const players = playerInfo.Player || []
    const vehicles = serverInfo?.Vehicles?.Vehicle || []

    // Dekodujemy wszystkie atrybuty pojazdów
    vehicles.forEach(v => {
      v['@_controller'] = decodeEntities(v['@_controller'])
      v['@_name'] = decodeEntities(v['@_name'])
    })

    for (const player of players) {
      if (player['@_isUsed'] !== 'true') continue

      // Dekodujemy nick gracza
      const playerName = decodeEntities(player['#text'])

      let x = parseFloat(player['@_x'])
      let y = parseFloat(player['@_y'])
      let z = parseFloat(player['@_z'])
      let in_machine = false
      let machine_name = null

      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        // Gracz nie ma pozycji → sprawdzamy pojazdy
        in_machine = true
        const vehicle = vehicles.find(v => v['@_controller'] === playerName)
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
        name: playerName,
        isAdmin: player['@_isAdmin'] === 'true',
        in_machine,
        machine_name,
        x,
        y,
        z
      })
    }

    state.rawdata = request
  }
}
