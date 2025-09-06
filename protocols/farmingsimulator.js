import Core from './core.js'
import { XMLParser, XMLValidator } from 'fast-xml-parser'

export default class farmingsimulator extends Core {
  async run (state) {
    // Zakładamy na początku, że serwer nie działa
    state.online = false

    try {
      if (!this.options.port) this.options.port = 8080
      if (!this.options.token) throw new Error(`No token provided. You can get it from http://${this.options.host}:${this.options.port}/settings.html`)

      const request = await this.request({
        url: `http://${this.options.host}:${this.options.port}/feed/dedicated-server-stats.xml?code=${this.options.token}`,
        responseType: 'text'
      })

      const isValidXML = XMLValidator.validate(request)
      if (!isValidXML) throw new Error('Invalid XML received from Farming Simulator Server')

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

      const playerList = {}

      for (const player of players) {
        if (player['@_isUsed'] !== 'true') continue

        const playerName = decodeEntities(player['#text'])
        let x = null
        let y = null
        let z = null
        let in_machine = false
        let machine_name = null

        // Najpierw sprawdzamy pojazd
        const vehicle = vehicles.find(v => v['@_controller'] === playerName)
        if (vehicle) {
          in_machine = true
          x = parseFloat(vehicle['@_x']) || null
          y = parseFloat(vehicle['@_y']) || null
          z = parseFloat(vehicle['@_z']) || null
          machine_name = vehicle['@_name'] || null
        } else {
          // Jeśli nie ma pojazdu, sprawdzamy pozycję gracza
          x = parseFloat(player['@_x']) || null
          y = parseFloat(player['@_y']) || null
          z = parseFloat(player['@_z']) || null
        }

        players.push({
          name: playerName,
          isAdmin: player['@_isAdmin'] === 'true',
          in_machine,
          machine_name,
          x,
          y,
          z
        })
      }

      // Serwer działa, więc online = true
      state.online = true

    } catch (err) {
      console.error('Błąd pobierania danych z serwera:', err)
      state.online = false
      state.players = {}
    }
  }
}
