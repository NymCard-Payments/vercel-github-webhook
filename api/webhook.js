export default async function handler(req, res) {
    if (req.method === 'POST') {
        console.log('GitHub Webhook Payload:', req.body);  // Log the GitHub webhook payload for debugging

        // Safely extract necessary properties from the webhook payload
        const head_commit = req.body?.head_commit || {};
        const repository = req.body?.repository || {};

        // Extract commit information safely
        const commitMessage = head_commit.message || 'No commit message';   // Get the commit message
        const commitDate = head_commit.timestamp || new Date().toISOString(); // Get the commit date or fallback to current date
        const developerName = head_commit.author?.name || 'Unknown Developer';  // Get the developer's name or set to 'Unknown'
        const repoName = repository.name || 'Unknown Repo';  // Get the name of the repository or set to 'Unknown'

        // Log extracted values for debugging
        console.log('Commit Message:', commitMessage);
        console.log('Commit Date:', commitDate);
        console.log('Developer Name:', developerName);
        console.log('Repository Name:', repoName);

        try {
            // Format column_values as an object and then stringify it to avoid GraphQL parsing issues
            const columnValues = {
                text4__1: developerName,
                text__1: commitMessage,
                date4: commitDate,
                text8__1: repoName
            };

            const response = await fetch('https://api.monday.com/v2', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQxMzc0NDI4MSwiYWFpIjoxMSwidWlkIjo2MDkzMDEyMywiaWFkIjoiMjAyNC0wOS0yMVQwODo1NToyNC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6ODcxMjM4MSwicmduIjoidXNlMSJ9.TS5QXrhhyI4zXSnc56XItuytJ-iklPrVB6TDF-MBdM0`,  // Replace with your API token
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `
                        mutation {
                            create_item (
                                board_id: 7452641398,  // Your board ID
                                item_name: "${developerName}",  // The developer's name as the item name in the monday.com board
                                column_values: "${JSON.stringify(columnValues).replace(/"/g, '\\"')}"  // Properly escape JSON string
                            ) {
                                id
                            }
                        }
                    `,
                }),
            });

            const result = await response.json();  // Parse the JSON response
            console.log('Response from Monday.com:', result);  // Log response for debugging

            if (response.ok) {
                res.status(200).json({ message: 'Commit data sent to monday.com' });
            } else {
                console.error('Error from Monday.com:', result);
                res.status(500).json({ message: `Error sending data to monday.com: ${result.errors ? result.errors[0].message : 'Unknown error'}` });
            }

        } catch (error) {
            console.error('Failed to send data to Monday.com:', error);
            res.status(500).json({ message: 'Failed to send data to monday.com', error: error.message });
        }
    } else {
        res.status(405).json({ message: 'Only POST requests are allowed' });
    }
}
