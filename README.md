# CERISoNet

## Certificats Generation

```
openssl genrsa -out key.pem
openssl req -new -key key.pem -out csr.pem
openssl x509 -req -days 9999 -in csr.pem -signkey
key.pem -out cert.pem
rm csr.pem
```

## SSH Connect

```
ssh uapv*******@pedago.univ-avignon.fr
```

## HTTPS Connect

```
https://pedago.univ-avignon.fr:3121
```


## Architecture CERISoNet

### Structure du projet

```
CERISoNet/
├── frontend/                       # Code source Angular
│   └── index.html                  # Page d'accueil
├── src/
│   └── server/                     # Serveur Node.js/Express unique
│       ├── certs/                  # Certificats SSL/TLS (cert.pem, key.pem)
│       └── src/                    # Code source du serveur
│           ├── config/             # Configuration (ports, chemins, etc.)
│           │   └── config.ts       
│           ├── domain/             # Logique métier
│           ├── infrastructure/     # Accès aux données
│           ├── interface/          # Couche API
│           │   ├── controllers/   
│           │   └── routes/         
│           └── index.ts            # Point d'entrée du serveur
├── package.json                    
└── tsconfig.json                   
```

### Scripts npm

- `npm run dev` : Démarre le serveur en mode développement
- `npm run build` : Compile le projet
- `npm run start` : Démarre le serveur en mode production
- `npm run lint` : Lint le code