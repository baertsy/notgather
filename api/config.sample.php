<?php
// Másold le ezt a fájlt config.php néven, és töltsd ki az adatokat.
// A config.php-t soha ne tedd fel GitHubra (a .gitignore kizárja).

return [
    'db' => [
        'host' => 'localhost',
        'name' => 'ADATBAZIS_NEVE',
        'user' => 'ADATBAZIS_FELHASZNALO',
        'pass' => 'ADATBAZIS_JELSZO',
    ],

    // Az alkalmazás neve (böngészőfül, belépőképernyő).
    'app_name' => 'NotGather',

    // A WebRTC kapcsolatfelépítéshez használt szerverek.
    // A STUN ingyenes és elég otthoni netekhez.
    'ice_servers' => [
        ['urls' => ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478']],

        // Ha valakinél nem jön létre hangkapcsolat (pl. mobilnet, VPN), ide
        // kell egy TURN szerver. Például a Metered.ca ingyenes keretéből:
        // [
        //     'urls' => ['turn:global.relay.metered.ca:80', 'turns:global.relay.metered.ca:443?transport=tcp'],
        //     'username' => 'METERED_FELHASZNALO',
        //     'credential' => 'METERED_JELSZO',
        // ],
    ],

    // Hány másodperc után számít valaki kilépettnek, ha nem jelez.
    'presence_timeout' => 20,
];
