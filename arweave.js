require('dotenv').config()
const Arweave = require('arweave')
const fetch = require('node-fetch')

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  timeout: 20000,
  logging: false,
})

const ADMIN_ADDR = process.env.ARWEAVE_ADDRESS
const KEY = JSON.parse(process.env.ARWEAVE_KEY)
const DOC_TYPE = "charter_doc_type"
const DOC_REF = "charter_doc_ref"
const SIG_NAME = "charter_sig_name"
const SIG_HANDLE = "charter_sig_handle"
const SIG_ADDR = "charter_sig_addr"
const SIG_ISVERIFIED = "charter_sig_verified"
const SIG_SIG = "charter_sig_signature"
const VERIFICATION_HANDLE = "charter_verif_handle"
const VERIFICATION_ADDR = "charter_verif_addr"

async function checkIfVerifiedAr(handle, address) {
  const req = await fetch('https://arweave.net/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: `
      query {
        transactions(
          tags: [
            {
              name: "${DOC_TYPE}",
              values: ["verification"]
            }
          ],
          owners: ["${ADMIN_ADDR}"]
        ) {
          edges {
            node {
              id
              owner {
                address
              }
              tags {
                name
                value
              }
            }
          }
        }
      }
      `
    })
  })

  const json = await req.json()
  for (const edge of json.data.transactions.edges) {
    const n = edge.node
    if (n.owner.address === ADMIN_ADDR) {
      const parsedHandle = n.tags.find(tag => tag.name === VERIFICATION_HANDLE).value
      const parsedAddress = n.tags.find(tag => tag.name === VERIFICATION_ADDR).value
      if (handle === parsedHandle && address === parsedAddress) {
        return n.id
      }
    }
  }
  return false
}

async function persistVerificationAr(handle, address) {
  let transaction = await arweave.createTransaction({
    data: handle
  }, KEY)
  transaction.addTag(DOC_TYPE, 'verification')
  transaction.addTag(VERIFICATION_HANDLE, handle)
  transaction.addTag(VERIFICATION_ADDR, address)
  await arweave.transactions.sign(transaction, KEY)
  return {
    ...await arweave.transactions.post(transaction),
    id: transaction.id,
  }
}

async function signDocumentAr(documentId, address, name, handle, signature, isVerified) {
  let transaction = await arweave.createTransaction({ data: address }, KEY)
  transaction.addTag(DOC_TYPE, 'signature')
  transaction.addTag(DOC_REF, documentId)
  transaction.addTag(SIG_NAME, name)
  transaction.addTag(SIG_HANDLE, handle)
  transaction.addTag(SIG_ADDR, address)
  transaction.addTag(SIG_SIG, signature)
  transaction.addTag(SIG_ISVERIFIED, isVerified)
  await arweave.transactions.sign(transaction, KEY)
  return await arweave.transactions.post(transaction)
}

module.exports = {
  checkIfVerifiedAr,
  persistVerificationAr,
  signDocumentAr,
  forkDocumentAr,
}
