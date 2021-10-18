const SDElements = require('./sdelements')
const core = require('@actions/core')
const github = require('@actions/github')

async function exec () {
    try
    {
        const config = parseConfig()
        const octokit = github.getOctokit(config.ghtoken)
        const sdelements = new SDElements(config.url, config.apitoken, config.project)
        
        switch(github.context.eventName) {
            case "issue":
                await handleIssue(sdelements, octokit, github)
                break
            case "issue_comment":
                await handleIssueComment(sdelements, octokit, github)
                break
            default:
                core.warning(`No supported event occurred (${github.context.eventName}).  Consider filtering your workflow`)
        }
    } catch (error) {
        core.error(error)
        process.exit(1)
    }
}

async function handleIssue(sdelements, octokit, github) {
    const task = await sdelements.findTaskFromIssueTitle(github.context.payload.issue.title)
    if(task !== null) {
        switch(github.context.payload.action) {
            case "closed":
                await sdelements.addNoteToTask(task.id, `${github.context.payload.sender.login} closed the issue`)
                break
            case "assigned":
            case "unassigned":
                const userList = []
                if(github.context.payload.issue.assignees.length > 0) {
                    for(var i = 0; i < github.context.payload.issue.assignees.length; i++) {
                        const userLogin = github.context.payload.issue.assignees[i].login
                        const user = await octokit.request("GET /users/{username}", {
                            username: userLogin
                        })
                        userList.push(user.email)
                    }
                }
                await sdelements.assignUsersToTask(task.id, userList)
                break;
            case "labeled":
            case "unlabeled":
                const tags = []
                if(github.context.payload.issue.labels.length > 0) {
                    for(var i = 0; i < github.context.payload.issue.labels.length; i++) {
                        tags.push(github.context.payload.issue.labels[i])
                    }
                }
                await sdelements.assignTagsToTask(task.id, tags)
                break
            default:
                core.warning(`No supported payload action (${github.context.payload.action}).  Please consider filtering your workflow.`)
                break
        }
    } else {
        core.warning(`SD Elements Task could not be found from title - ${github.context.payload.issue.title}`)
    }
}

async function handleIssueComment(sdelements, octokit, github) {
    const task = await sdelements.findTaskFromIssueTitle(github.context.payload.issue.title)
    if(task !== null) {
        switch(github.context.payload.action) {
            case "created":
                const comment = github.context.payload.comment.body.trimStart()
                // Support commands
                if(comment.startsWith('/sdpass')) {
                    const userLogin = github.context.payload.issue.assignees[i].login
                    const user = await octokit.request("GET /users/{username}", {
                        username: userLogin
                    })
                    await sdelements.createAVerificationNote(task.id, user.email, "pass", github.context.payload.comment.html_url, null)
                } else if(comment.startsWith('/sdfail')) {
                    const userLogin = github.context.payload.issue.assignees[i].login
                    const user = await octokit.request("GET /users/{username}", {
                        username: userLogin
                    })
                    const commentDesc = comment.substring(7, str.length).trimStart();
                    await sdelements.createAVerificationNote(task.id, user.email, "fail", github.context.payload.comment.html_url, commentDesc)
                } else {
                    await sdelements.addNoteToTask(task.id, `[${github.context.payload.comment.user.login}] ${comment}`)
                }
                break
            default:
                core.warning(`No supported payload action (${github.context.payload.action}).  Please consider filtering your workflow.`)
                break
        }
    } else {
        core.warning(`SD Elements Task could not be found from title - ${github.context.payload.issue.title}`)
    }
}

function parseConfig () {
    return {
      url: core.getInput('url', { required: true }),
      apitoken: core.getInput('apitoken', { required: true }),
      project: core.getInput('project', { required: true }),
      ghtoken: core.getInput('gh_token', { required: true })
    }
}

exec()