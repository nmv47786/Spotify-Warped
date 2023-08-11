const { VITE_SPOTIFY_CLIENT_ID, VITE_TM_CLIENT_ID } = import.meta.env;

// Access and use environment variables
const SpotifyClientId = VITE_SPOTIFY_CLIENT_ID;
const TMClientId = VITE_TM_CLIENT_ID;

const params = new URLSearchParams(window.location.search);
const code = params.get("code");
run();

async function run() {
    if (!code) {
        redirectToAuthCodeFlow(SpotifyClientId);
    } else {
        const accessToken = await getAccessToken(SpotifyClientId, code);
        const profile = await fetchProfile(accessToken);
        
        // populate UI in this
        getAndUseUserLocation(accessToken, profile);
    }
}

export async function redirectToAuthCodeFlow(SpotifyClientId) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", SpotifyClientId);
    params.append("response_type", "code");
    //params.append("redirect_uri", "http://localhost:5173/callback");
    params.append("redirect_uri", "https://concertfinder-test.netlify.app/callback");
    params.append("scope", "user-read-private user-read-email user-top-read user-follow-read playlist-modify-public playlist-modify-private playlist-read-private");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export async function getAccessToken(SpotifyClientId, code) {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", SpotifyClientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    //params.append("redirect_uri", "http://localhost:5173/callback");
    params.append("redirect_uri", "https://concertfinder-test.netlify.app/callback");
    params.append("code_verifier", verifier);
    const body = new URLSearchParams(params).toString();
    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body
    });

    const { access_token } = await result.json();
    return access_token;
}

async function fetchProfile(token) {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

// Request user's geolocation permission and get latitude and longitude
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    resolve({ latitude, longitude });
                },
                error => {
                    console.error("Error getting user's location:", error);
                    reject(error);
                }
            );
        } else {
            reject("Geolocation is not available in this browser.");
        }
    });
}

// Call this function when you need to get the user's location
async function getAndUseUserLocation(token, profile) {
    try {
        let userLocation = await getUserLocation();
        if (!userLocation) {
            // Use Atlanta's latitude and longitude as default
            userLocation = { latitude: 33.7490, longitude: -84.3880 };
        }
        
        // Use userLocation.latitude and userLocation.longitude in your code
        console.log("User's Latitude:", userLocation.latitude);
        console.log("User's Longitude:", userLocation.longitude);

        // Call your populateUI function with the obtained user location and token
        populateUI(profile, token, userLocation.latitude, userLocation.longitude);
    } catch (error) {
        // Handle error if geolocation is not available or user denies permission
        console.error("Error:", error);
    }
}

async function fetchWebApi(endpoint, method, body, token) {
    const fetchOptions = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        method
    };
    
    // Add body only if method is not GET or HEAD
    if (method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(`https://api.spotify.com/${endpoint}`, fetchOptions);
        if (!res.ok) {
            throw new Error(`Fetch error: ${res.status} ${res.statusText}`);
        }
        return await res.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error; // Rethrow the error so it can be caught by the caller.
    }
}
  
async function getTopTracks(token){
    // Endpoint reference : https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
    const result = await fetchWebApi('v1/me/top/tracks', 'GET', undefined, token);
    return result.items;
}

async function getTopArtists(token){
    // Endpoint reference : https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
    const result = await fetchWebApi('v1/me/top/artists', 'GET', undefined, token);
    return result.items;
}

async function moreArtists(token){
    // Endpoint reference : https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
    const result = await fetchWebApi('v1/me/top/artists?time_range=short_term', 'GET', undefined, token);
    return result.items;
}

async function evenMoreArtists(token){
    // Endpoint reference : https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
    const result = await fetchWebApi('v1/me/top/artists?time_range=long_term', 'GET', undefined, token);
    return result.items;
}

async function getArtistID(token) {
    const result = await fetchWebApi('v1/me/top/artists', 'GET', undefined, token);
    return result.items.map((artist) => artist.id);
}

async function createPlaylist(trackURIs, userId, token) {
    const baseName = "My New Favorite Playlist";
    let playlistNumber = 1;
    let playlistName = `${baseName}`;

    // Check if a playlist with the current name already exists
    while (await doesPlaylistExist(userId, playlistName, token)) {
        playlistNumber++;
        playlistName = `${baseName} #${playlistNumber}`;
    }

    console.log("Creating playlist:", playlistName);
    
    const playlist = await fetchWebApi(
        `v1/users/${userId}/playlists`, 'POST', {
            "name": playlistName,
            "description": "Playlist created by concertfinder",
            "public": false
        }, token);

    await fetchWebApi(
        `v1/playlists/${playlist.id}/tracks?uris=${trackURIs.join(',')}`,
        'POST', undefined, token);

    return playlist;
}

// Function to check if a playlist with a given name exists for a user
async function doesPlaylistExist(userId, playlistName, token) {
    const playlists = await fetchWebApi(
        `v1/users/${userId}/playlists`, 'GET', undefined, token);

    return playlists.items.some(playlist => playlist.name === playlistName);
}

async function getAudioFeatures(token, songs) {
    const result = await fetchWebApi(`v1/audio-features?ids=${songs.join(',')}`, 'GET', undefined, token);
    const audioFeatures = result.audio_features;
    
    console.log(audioFeatures);
    let danceability = 0;
    let energy = 0;
    let valence = 0;
    let speechiness = 0;
    let instrumentalness = 0;
    let acousticness = 0;
    let liveness = 0;
    let loudness = 0;
    audioFeatures.forEach(song => {
        danceability += song.danceability;
        energy += song.energy;
        valence += song.valence;
        speechiness += song.speechiness;
        instrumentalness += song.instrumentalness;
        acousticness += song.acousticness;
        liveness += song.liveness;
        loudness += song.loudness;
    });

    const averageFeatures = {
        danceability: danceability / audioFeatures.length,
        energy: energy / audioFeatures.length,
        valence: valence / audioFeatures.length,
        speechiness: speechiness / audioFeatures.length,
        instrumentalness: instrumentalness / audioFeatures.length,
        acousticness: acousticness / audioFeatures.length,
        liveness: liveness / audioFeatures.length,
        loudness: loudness / audioFeatures.length
    };

    return averageFeatures;
}

// Top genres
async function getTopGenres(token) {
    const result = await fetchWebApi('v1/me/top/tracks?offset=0&limit=50', 'GET', undefined, token);
    const tracks = result.items;

    const genreCountMap = new Map(); // Map to store genre counts

    tracks.forEach(track => {
        console.log("track", track);
        
        if (track.artists && Array.isArray(track.artists)) {
            track.artists.forEach(artist => {
                console.log("artist", artist);

                if (artist.genres && Array.isArray(artist.genres)) {
                    artist.genres.forEach(genre => {
                        console.log("genre", genre);
                        genreCountMap.set(genre, (genreCountMap.get(genre) || 0) + 1);
                    });
                }
            });
        }
    });

    // Convert the Map to an array of objects
    const genreCounts = Array.from(genreCountMap, ([genre, count]) => ({ genre, count }));

    // Sort the genre counts in descending order
    genreCounts.sort((a, b) => b.count - a.count);

    // Get the top 10 genres
    const topGenres = genreCounts.slice(0, 10);

    return topGenres;
}





  async function getRecommendedTracks(token, IDs) {
    const recommendedTracks = [];

    // Divide IDs array into chunks of 5 tracks
    const chunkSize = 5;
    for (let i = 0; i < IDs.length; i += chunkSize) {
        const chunk = IDs.slice(i, i + chunkSize);
        const url = `v1/recommendations?limit=5&seed_tracks=${chunk.join(',')}`;

        try {
            const result = await fetchWebApi(url, 'GET', undefined, token);
            recommendedTracks.push(...result.tracks);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            throw error; // Rethrow the error so it can be caught by the caller.
        }
    }

    return recommendedTracks;
}

async function getRecommendedArtists(token, IDs) {
    const recommendedArtists = [];

    // Divide IDs array into chunks of 1 artist
    for (let i = 0; i < IDs.length; i++) {
        const chunk = IDs.slice(i, i + 1);
        const artistId = chunk[0];
        const url = `v1/artists/${artistId}/related-artists`;

        try {
            const result = await fetchWebApi(url, 'GET', undefined, token);
            const relatedArtists = result.artists.map(({ name }) => name);
            const randomIndex = Math.floor(Math.random() * relatedArtists.length);
            const randomArtist = relatedArtists[randomIndex];
            recommendedArtists.push(randomArtist);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            throw error; // Rethrow the error so it can be caught by the caller.
        }
    }

    return recommendedArtists;
}

function populateFlyer(lineup) {
    const lineupArray = Array.from(lineup);
    const numArtists = lineupArray.length;
    const headliners = lineupArray.slice(0, 3);
    const day1Artists = new Set();
    const day2Artists = new Set();
    const day3Artists = new Set();
    for(let i = 3; i < numArtists; i+=3) {
        if (i < numArtists){
            day1Artists.add(lineupArray[i]);
        }
        if (i+1 < numArtists){
            day2Artists.add(lineupArray[i+1]);
        }
        if (i+2 < numArtists){
            day3Artists.add(lineupArray[i+2]);
        }
    }

    const headlinerElements = document.querySelectorAll(".flyerHeadliner");
    const day1ArtistsElement = document.getElementById("day1Artists");
    const day2ArtistsElement = document.getElementById("day2Artists");
    const day3ArtistsElement = document.getElementById("day3Artists");

    day1Artists.forEach(artist => {
        day1ArtistsElement.innerHTML += `<div class="flyerArtist">${artist}</div>`;
    });

    day2Artists.forEach(artist => {
        day2ArtistsElement.innerHTML += `<div class="flyerArtist">${artist}</div>`;
    });

    day3Artists.forEach(artist => {
        day3ArtistsElement.innerHTML += `<div class="flyerArtist">${artist}</div>`;
    });

    for (let i = 0; i < headliners.length; i++) {
        headlinerElements[i].textContent = headliners[i];
    }
}

// Function to search for events for a specific artist
async function searchEventsForArtist(artistName, latitude, longitude, maxDistance) {
    const endpoint = `https://app.ticketmaster.com/discovery/v2/events.json?keyword=${encodeURIComponent(artistName)}&size=5&latlong=${latitude},${longitude}&radius=${maxDistance}&apikey=${TMClientId}`;

    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        const events = data._embedded ? data._embedded.events : [];

        const eventInfoList = [];

        for (const event of events) {
            const eventName = event.name;
            const eventDate = event.dates.start.localDate;
            const eventCity = event._embedded.venues[0].city.name;
            const eventVenue = event._embedded.venues[0].name;
            const eventTime = event.dates.start.localTime;
            const eventUrl = event.url;

            eventInfoList.push({
                eventName,
                eventDate,
                eventCity,
                eventVenue,
                eventTime,
                eventUrl
            });
        }
        return eventInfoList;
    } catch (error) {
        //console.error(`Error fetching events for ${artistName}:`, error);
        return [];
    }
}

// Function to check events for all artists in festivalList Set
async function checkEventsForFestivalArtists(list, latitude, longitude, maxDistance) {
    const concertInfo = [];

    const festivalList = Array.from(list);

    for (const artist of festivalList) {
        const eventInfoList = await searchEventsForArtist(artist, latitude, longitude, maxDistance);

        if (eventInfoList && eventInfoList.length > 0) {
            // Sort the eventInfoList by date in ascending order
            eventInfoList.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
        
            for (const eventInfo of eventInfoList) {
                const { eventName, eventDate, eventCity, eventVenue, eventTime, eventUrl } = eventInfo;
        
                const parsedTime = new Date(`2000-01-01T${eventTime}`);
                const formattedTime = parsedTime.toString() !== 'Invalid Date'
                    ? parsedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    : '';        
                const parsedDate = new Date(eventDate);
                const formattedDate = parsedDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        
                // Generate the setlist.fm URL for the artist
                const setlistURL = generateSetlistURL(artist);

                const isArtistInEventName = eventName.toLowerCase().includes(artist.toLowerCase());
                // Format the concert info
                let concertInfoFormatted = '';
                if (isArtistInEventName) {
                    concertInfoFormatted = `
                        ${eventName} on ${formattedDate} ${formattedTime ? `at ${formattedTime}` : ''} <br>
                        City: ${eventCity}<br>
                        Venue: ${eventVenue}<br>
                        <a href="${eventUrl}" target="_blank">Buy Tickets</a><br>
                        <a href="${setlistURL}" target="_blank">View Setlist Statistics</a>
                    `;
                } else {
                    concertInfoFormatted = `
                        ${eventName} featuring ${artist} on ${formattedDate} ${formattedTime ? `at ${formattedTime}` : ''} <br>
                        City: ${eventCity}<br>
                        Venue: ${eventVenue}<br>
                        <a href="${eventUrl}" target="_blank">Buy Tickets</a><br>
                        <a href="${setlistURL}" target="_blank">View Setlist Statistics</a>
                    `;
                }
                concertInfo.push(concertInfoFormatted);
            }
        }
    }
    return concertInfo;
}


function generateSetlistURL(artistName) {
    const encodedArtist = encodeURIComponent(artistName);
    return `https://www.setlist.fm/search?query=${encodedArtist}`;
}

async function populateUI(profile, token, latitude, longitude) {
    document.getElementById("displayName").innerText = profile.display_name;
    if (profile.images[0]) {
        const profileImage = new Image(200, 200);
        profileImage.src = profile.images[0].url;
        document.getElementById("avatar").appendChild(profileImage);
        //document.getElementById("imgUrl").innerText = profile.images[0].url;
    } else {
        // Handle the case when there is no profile image
        const defaultProfileImage = new Image(200, 200);
        defaultProfileImage.src = "../public/default.png";
        document.getElementById("avatar").appendChild(defaultProfileImage);
    }
    document.getElementById("id").innerText = profile.id;
    document.getElementById("email").innerText = profile.email;
    document.getElementById("followers").innerText = profile.followers.total;
    document.getElementById("uri").innerText = profile.uri;
    document.getElementById("uri").setAttribute("href", profile.external_urls.spotify);

    //top tracks
    const topTracks = await getTopTracks(token);
    if (Array.isArray(topTracks)) {
        const topTracksList = topTracks.map(({ name, artists }) =>
            `${name} by ${artists.map(artist => artist.name).join(', ')}`
        );
        document.getElementById("topTracks").innerText = topTracksList.join("\n");
        const features = await getAudioFeatures(token, topTracks.map(({ id }) => id));
        console.log("danceability", features.danceability);
        console.log("energy", features.energy);
        console.log("valence", features.valence);
        console.log("speechiness", features.speechiness);
        console.log("instrumentalness", features.instrumentalness);
        console.log("acousticness", features.acousticness);
        console.log("liveness", features.liveness);
        console.log("loudness", features.loudness);
    } else {
        document.getElementById("topTracks").innerText = "No top tracks found.";
    }

    // Top Genres
    const genres = await getTopGenres(token);
    if (Array.isArray(genres)) {
        const genreList = genres.map(({ genre, count}) =>
        `${genre}: ${count}`
        );
        console.log("GenreList: ",genreList);
    }
    console.log ("Genres: ",genres);

    //top artists
    const topArtists = await getTopArtists(token);
    if (Array.isArray(topArtists)) {
        const topArtistsList = topArtists.map(({ name }) =>
            name
        );
        document.getElementById("topArtists").innerText = topArtistsList.join("\n");
    } else {
        document.getElementById("topArtists").innerText = "No top artists found.";
    }

    const topTrackIds = topTracks.map(({ id }) => id);
    //console.log("trackID", topTrackIds);
    if (Array.isArray(topTrackIds) && topTrackIds.length > 0) {
      const recommendedTracks = await getRecommendedTracks(token, topTrackIds);
      //console.log("Recommended Tracks:", recommendedTracks); // Check the recommended tracks in the console to verify the data.
  
      if (Array.isArray(recommendedTracks)) {
        const recommendedTracksList = recommendedTracks.map(({ name, artists }) =>
          `${name} by ${artists.map((artist) => artist.name).join(', ')}`
        );
        //console.log("Recommended Tracks List:", recommendedTracksList); // Check the recommended tracks list in the console.
  
        document.getElementById("recommendedTracks").innerText = recommendedTracksList.join("\n");
        //const playlistTracksList = [...topTracks, ...recommendedTracks].map(track => track.uri);
        const selectedTopTracks = topTracks.sort(() => Math.random() - 0.5).slice(0, 7);
        const playlistTracksList = [...selectedTopTracks, ...recommendedTracks].map(track => track.uri);

        // Shuffle the playlistTracksList using Fisher-Yates shuffle algorithm
        for (let i = playlistTracksList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playlistTracksList[i], playlistTracksList[j]] = [playlistTracksList[j], playlistTracksList[i]];
        }

        console.log("playlistTracks", playlistTracksList)
        const createPlaylistButton = document.getElementById('createPlaylistButton');
        const playlistCreatedMessage = document.getElementById('playlistCreatedMessage');

        createPlaylistButton.addEventListener('click', async () => {
            try {
                const createdPlaylist = await createPlaylist(playlistTracksList, profile.id, token);

                const features = await getAudioFeatures(token, playlistTracksList.map(({ id }) => id));
                console.log("danceability", features.danceability);
                console.log("energy", features.energy);
                console.log("valence", features.valence);
                console.log("speechiness", features.speechiness);
                console.log("instrumentalness", features.instrumentalness);
                console.log("acousticness", features.acousticness);
                console.log("liveness", features.liveness);
                console.log("loudness", features.loudness);
                // Hide the button after it has been clicked
                createPlaylistButton.style.display = 'none';
                // Display the playlist created message
                playlistCreatedMessage.textContent = `A playlist named "${createdPlaylist.name}" has been created.`;
        } catch (error) {
            console.error('Error creating playlist:', error);
        }
    });

      } else {
        document.getElementById("recommendedTracks").innerText = "No recommended tracks found.";
      }
    } else {
      document.getElementById("recommendedTracks").innerText = "No top tracks found.";
    }

    //festival
    const topArtistIds = await getArtistID(token);
    if (Array.isArray(topArtists) && topArtists.length > 0) {
        const recommendedArtists = await getRecommendedArtists(token, topArtistIds);
        const additionalArtists = await moreArtists(token);
        const lifetimeArtists = await evenMoreArtists(token);
        //console.log("Recommended Artists:", recommendedArtists);

        // Combine topArtists, recommendedArtists, and artists from topTracks
        const allArtists = new Set([
            ...topArtists.map(({ name }) => name),
            ...recommendedArtists,
            ...additionalArtists.map(({ name }) => name),
            ...lifetimeArtists.map(({ name }) => name),
        ]);
        /*const concertArtists = new Set([
            ...allArtists.map(({ name }) => name),
            ...lifetimeArtists.map(({ name }) => name),
        ]);*/
        const festivalList = Array.from(allArtists);
        //const concertList = Array.from(concertArtists);
        console.log("Festival List:", Array.from(festivalList));
        // Call the function to check events for all artists in festivalList Set
        const maxDistance = 100;
        checkEventsForFestivalArtists(festivalList, latitude, longitude, maxDistance).then(concertInfo => {
            const eventInfoContainer = document.getElementById("eventInfo");
            if (concertInfo.length > 0) {
                const eventInfoHtml = concertInfo.map(info => `<p>${info}</p>`).join(""); // Create HTML from concertInfo array
                eventInfoContainer.innerHTML = `
                    <div class="eventInfoHeader">Upcoming Concerts</div>
                    ${eventInfoHtml}
                `;
            } else {
                eventInfoContainer.innerHTML = `
                    <div class="eventInfoHeader">No Upcoming Concerts Found</div>
                `;
            }
        });
        window.onload = populateFlyer(festivalList);
    }
    
}