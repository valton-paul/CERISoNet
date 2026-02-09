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

### Scripts npm

- `npm run dev` : Démarre le serveur en mode développement

