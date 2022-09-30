const shell = require('shelljs')
const fs = require('fs')

function updatePackageDistJson() {
    const pkg = { ...JSON.parse(fs.readFileSync('package.json')) }
    delete pkg['devDependencies']
    delete pkg['scripts']
    pkg['main'] = 'cjs/index.js'
    pkg['module'] = 'es/index.js'
    fs.writeFileSync('dist/package.json', JSON.stringify(pkg, null, 4))
}

async function start() {
    shell.rm('-rf', 'dist')
    shell.mkdir('dist')
    shell.cp('-rf', './build/es', 'dist/')
    shell.cp('-rf', './build/cjs', 'dist/')
    updatePackageDistJson()
    shell.cp('-rf', 'README.md', 'dist/')
}

start()
