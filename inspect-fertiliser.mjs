import { read, utils } from 'xlsx'
import { readFileSync } from 'fs'

const file = readFileSync('data/Fertilize-Details-ebbe7f.xlsx')
const workbook = read(file, { cellDates: true })

console.log('Sheet names:', workbook.SheetNames)
console.log('\nFirst sheet:', workbook.SheetNames[0])

const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = utils.sheet_to_json(sheet)

console.log('\nColumn headers:', Object.keys(rows[0] || {}))
console.log('\nFirst 5 rows:')
console.log(JSON.stringify(rows.slice(0, 5), null, 2))
console.log('\nTotal rows:', rows.length)
