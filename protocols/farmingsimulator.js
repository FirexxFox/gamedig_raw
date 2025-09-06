import Core from './core.js'
import { XMLParser, XMLValidator } from 'fast-xml-parser'

export default class farmingsimulator extends Core {
  async run (state) {
    state.online = false
    state.players = []

    try {
      if (!this.options.port) this.options.port = 8080
      if (!this.options.token) throw new Error(`No token provided. You can get it from http://${this.options.host}:${this.options.port}/settings.html`)

      const request = await this.request({
        url: `http://${this.options.host}:${this.options.port}/feed/dedicated-server-stats.xml?code=${this.options.token}`,
        responseType: 'text'
      })

      if (!XMLValidator.validate(request)) throw new Error('Invalid XML received from Farming Simulator Server')

      const parser = new XMLParser({ ignoreAttributes: false })
      const parsed = parser.parse(request)

      const serverInfo = parsed.Server
      const playerInfo = serverInfo.Slots

      state.name = serverInfo['@_name']
      state.map = serverInfo['@_mapName']
      state.numplayers = parseInt(playerInfo['@_numUsed'], 10) || 0
      state.maxplayers = parseInt(playerInfo['@_capacity'], 10) || 0

      const decodeEntities = str => str
        ? str
            .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&#94;/g, '^')
        : str

      const players = playerInfo.Player || []
      const vehicles = serverInfo?.Vehicles?.Vehicle || []

      vehicles.forEach(v => {
        v['@_controller'] = decodeEntities(v['@_controller'])
        v['@_name'] = decodeEntities(v['@_name'])
      })

      let idCounter = 1
      for (const player of players) {
        if (player['@_isUsed'] !== 'true') continue

        const playerName = decodeEntities(player['#text'])
        let x = null, z = null
        let machine_name = "brak"

        const vehicle = vehicles.find(v => v['@_controller'] === playerName)
        if (vehicle) {
          machine_name = vehicle['@_name'] || "brak"
          x = parseFloat(vehicle['@_x']) || null
          z = parseFloat(vehicle['@_z']) || null
        } else {
          x = parseFloat(player['@_x']) || null
          z = parseFloat(player['@_z']) || null
        }

        state.players.push({
          id: idCounter,
          name: playerName,
          isAdmin: player['@_isAdmin'] === 'true',
          machine_name,
          x,
          z
        })

        idCounter++
      }

      state.online = true

    } catch (err) {
      console.error('Błąd pobierania danych z serwera:', err)
      state.online = false
      state.players = []
    }
  }
}
