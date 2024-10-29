export default async function handler(req, res) {
  if (req.method === 'POST') {
    const commitData = req.body;

    // Validate if this is a push event, if not, exit
    if (!commitData.ref || !commitData.commits) {
      return res.status(400).json({ error: 'Not a valid push event' });
    }

   // Extract and process each commit
   const commits = await Promise.all(commitData.commits
    .filter(commit => commit.author.username !== 'Devtools')
    .map(async commit => {
      try {
        // Fetch the full commit details from GitHub API to get LOC changes
        const commitDetailResponse = await fetch(`https://api.github.com/repos/${commitData.repository.full_name}/commits/${commit.id}`, {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (!commitDetailResponse.ok) {
          throw new Error(`Failed to fetch commit details for commit ${commit.id}`);
        }

        const commitDetail = await commitDetailResponse.json();

        // Check if stats, additions, and deletions exist before accessing them
        const linesAdded = commitDetail.stats?.additions || 0; // Default to 0 if undefined
        const linesDeleted = commitDetail.stats?.deletions || 0; // Default to 0 if undefined

        return {
          message: commit.message,
          username: commit.author.username || commit.author.name,
          author: commit.author.name,
          url: commit.url,
          timestamp: commit.timestamp,
          repository: commitData.repository.name,
          linesAdded,
          linesDeleted
        };
      } catch (error) {
        console.error(`Error processing commit ${commit.id}:`, error);
        return null; // Skip this commit if there's an error
      }
    })
  );

  // Filter out any null values from the commits array
  const validCommits = commits.filter(commit => commit !== null);

    // If no commits remain after filtering, skip sending to Monday.com
    if (commits.length === 0) {
      return res.status(200).json({ message: 'No valid commits to process' });
    }

    // Send the commits to Monday.com
    try {
      const mondayResult = await sendCommitsToMonday(commits);
      res.status(200).json({ success: true, data: mondayResult });
    } catch (error) {
      console.error('Error sending data to Monday.com:', error);
      res.status(500).json({ error: 'Failed to send data to Monday.com' });
    }
  } else {
    res.status(405).json({ message: 'Only POST requests are accepted' });
  }
}

// Function to send commits data to Monday.com
async function sendCommitsToMonday(commits) {
  const mondayApiUrl = 'https://api.monday.com/v2';
  const mondayApiKey = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_BOARD_ID;

  const results = [];

  // Loop through each commit and send it as an item to the Monday.com board
  for (const commit of commits) {
    // Format timestamp to only include date (e.g., 2023-10-03)
    const formattedTimestamp = commit.timestamp.split('T')[0];

    // GraphQL mutation query to create an item on the Monday.com board
    const query = `
      mutation {
        create_item (
          board_id: ${boardId},
          item_name: "${commit.message}",
          column_values: "{\\"text4__1\\": \\"${commit.author}\\", \\"text6__1\\": \\"${commit.username}\\", \\"text__1\\": \\"${commit.url}\\", \\"date__1\\": \\"${formattedTimestamp}\\", \\"text8__1\\": \\"${commit.repository}\\,  \\"text80__1\\": \\"${commit.linesAdded}\\", \\"text_1__1\\": \\"${commit.linesDeleted}\\"}"
        ) {
          id
        }
      }
    `;

    // Send the request to the Monday.com API
    const response = await fetch(mondayApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mondayApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    // Handle the API response and store the result
    const result = await response.json();
    results.push(result);
  }

  return results;
}

