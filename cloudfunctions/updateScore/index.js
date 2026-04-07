const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_SCORE = 150

// 内容安全检测：使用微信 msgSecCheck 接口
async function checkText(text, openid) {
  if (!text) return true
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content: text,
      version: 2,
      scene: 1,
      openid: openid
    })
    // result.suggest: "pass" / "review" / "risky"
    if (res.result && res.result.suggest !== 'pass') {
      return false
    }
    return true
  } catch (err) {
    console.error('msgSecCheck error:', err)
    // 接口异常时放行，避免影响正常使用
    return true
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { score, nickname, round } = event

  // 校验
  if (typeof score !== 'number' || score <= 0 || score > MAX_SCORE) {
    return { code: -1, msg: '非法分数' }
  }
  if (![1, 2, 3].includes(round)) {
    return { code: -1, msg: '非法局数' }
  }

  // 昵称内容安全检测
  const nickSafe = await checkText(nickname, openid)
  if (!nickSafe) {
    return { code: -2, msg: '昵称含违规内容，请修改' }
  }

  try {
    // 查询该用户在该局的记录
    const res = await db.collection('ranking').where({ openid, round }).get()

    if (res.data.length > 0) {
      const record = res.data[0]
      if (score > record.score) {
        await db.collection('ranking').doc(record._id).update({
          data: {
            score,
            nickname: nickname || '匿名玩家',
            updateTime: db.serverDate()
          }
        })
        return { code: 0, msg: '新纪录！', newRecord: true }
      }
      return { code: 0, msg: '未超过最高分', newRecord: false }
    } else {
      await db.collection('ranking').add({
        data: {
          openid,
          score,
          nickname: nickname || '匿名玩家',
          round,
          avatarUrl: '',
          updateTime: db.serverDate()
        }
      })
      return { code: 0, msg: '首次记录', newRecord: true }
    }
  } catch (err) {
    console.error('updateScore error:', err)
    return { code: -1, msg: '服务异常' }
  }
}
