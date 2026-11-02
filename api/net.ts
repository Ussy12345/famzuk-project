// Makes Node's fetch patient on slow or IPv6-broken networks.
import dns from 'node:dns'
import net from 'node:net'
import { Agent, setGlobalDispatcher } from 'undici'
dns.setDefaultResultOrder('ipv4first')
net.setDefaultAutoSelectFamily(false)
setGlobalDispatcher(new Agent({ connect: { timeout: 40000 }, headersTimeout: 120000, bodyTimeout: 120000 }))
