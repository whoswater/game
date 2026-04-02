const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_SCORE = 150

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
